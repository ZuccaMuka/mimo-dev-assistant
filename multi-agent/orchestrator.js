import { PlannerAgent } from "./agents/planner.js";
import { BuilderAgent } from "./agents/builder.js";
import { ReviewerAgent } from "./agents/reviewer.js";
import { CodexAgent } from "./agents/codex.js";
import { ClaudeCodeAgent } from "./agents/claude.js";
import { MiMoAgent } from "./agents/mimo.js";
import { HermesAgent } from "./agents/hermes.js";
import { MistralProvider } from "./providers/mistral.js";
import { TogetherProvider } from "./providers/together.js";
import { ReplicateProvider } from "./providers/replicate.js";
import { MediaGenerator } from "./media/generator.js";
import { VideoEditor } from "./media/editor.js";
import { MediaAnalyzer } from "./media/analyzer.js";
import { globalStore } from "./memory/store.js";
import { globalTracker } from "./memory/tasks.js";
import { setProjectRoot } from "./tools/registry.js";

export class Orchestrator {
  constructor(config = {}) {
    this.planner = new PlannerAgent(config);
    this.builder = new BuilderAgent(config);
    this.reviewer = new ReviewerAgent(config);
    this.codex = new CodexAgent(config);
    this.claude = new ClaudeCodeAgent(config);
    this.mimo = new MiMoAgent(config);
    this.hermesAgent = new HermesAgent(config);
    this.persistent = config.persistent || null;

    this.builderEngine = config.builderEngine || "hermes-cli"; // "hermes-cli", "hermes", "codex", "mimo", "claude", "mistral", "together"

    this.mistral = new MistralProvider(config);
    this.together = new TogetherProvider(config);
    this.replicate = new ReplicateProvider(config);
    this.mediaGenerator = new MediaGenerator(config);
    this.videoEditor = new VideoEditor(config);
    this.mediaAnalyzer = new MediaAnalyzer(config);

    this.planner.registerSubAgent("builder", BuilderAgent);
    this.planner.registerSubAgent("codex", CodexAgent);
    this.planner.registerSubAgent("mimo", MiMoAgent);
    this.builder.registerSubAgent("reviewer", ReviewerAgent);

    if (config.projectDir) {
      setProjectRoot(config.projectDir);
    }
  }

  async handleRequest(userPrompt, options = {}) {
    const { maxRetries = 2, skipReview = false, streamResponse = null } = options;
    const sessionId = `session_${Date.now()}`;

    globalStore.createSession(sessionId);
    globalStore.addMessage(sessionId, "user", userPrompt);

    if (this.persistent) {
      this.persistent.saveSession({
        id: sessionId,
        prompt: userPrompt,
        createdAt: Date.now(),
        status: "processing",
      });
    }

    console.log(`\n[Orchestrator] Processing: "${userPrompt.slice(0, 50)}..."`);
    console.log(`[Orchestrator] Session: ${sessionId}\n`);

    const sendEvent = (event) => {
      if (streamResponse && !streamResponse.writableEnded) {
        streamResponse.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    };

    sendEvent({ type: "start", sessionId, prompt: userPrompt });

    try {
      sendEvent({ type: "phase", phase: "planning" });
      const plan = await this.planner.analyze(userPrompt);
      console.log(`[Orchestrator] Created ${plan.tasks.length} tasks\n`);

      sendEvent({ type: "plan", tasks: plan.tasks });

      for (const taskData of plan.tasks) {
        globalTracker.createTask(taskData);
      }

      sendEvent({ type: "phase", phase: "executing" });
      const results = await this.executeTasks(sessionId, sendEvent);

      let review = null;
      if (!skipReview) {
        sendEvent({ type: "phase", phase: "reviewing" });
        console.log("\n[Orchestrator] Starting code review...\n");
        review = await this.reviewer.review(
          { name: "Full implementation", files: results.map((r) => r.files).flat() },
          { results }
        );
        console.log(`[Orchestrator] Review: ${review.approved ? "APPROVED" : "NEEDS FIXES"}`);

        sendEvent({ type: "review", approved: review.approved, issues: review.issues?.length || 0 });

        if (!review.approved && review.issues.length > 0) {
          console.log(`[Orchestrator] Found ${review.issues.length} issues`);

          sendEvent({ type: "phase", phase: "fixing" });

          for (let retry = 0; retry < maxRetries; retry++) {
            console.log(`[Orchestrator] Fixing issues (attempt ${retry + 1})...`);

            const fixResults = await this.fixIssues(review.issues, results, sendEvent);
            results.push(...fixResults);

            review = await this.reviewer.review(
              { name: "Fixed implementation", files: fixResults.map((r) => r.files).flat() },
              { results, previousReview: review }
            );

            if (review.approved) {
              console.log("[Orchestrator] Issues fixed!\n");
              break;
            }
          }
        }
      }

      const summary = this.summarize(results, review);
      globalStore.addResult(sessionId, summary);

      if (this.persistent) {
        this.persistent.saveSession({
          id: sessionId,
          prompt: userPrompt,
          plan,
          results,
          review,
          summary,
          createdAt: Date.now(),
          completedAt: Date.now(),
          status: "completed",
        });
      }

      sendEvent({ type: "complete", summary });

      return {
        sessionId,
        plan,
        results,
        review,
        summary,
      };
    } catch (error) {
      console.error("[Orchestrator] Error:", error.message);

      sendEvent({ type: "error", error: error.message });

      return {
        sessionId,
        error: error.message,
        tasks: globalTracker.getAllTasks(),
      };
    }
  }

  async executeTasks(sessionId, sendEvent = null) {
    const results = [];
    let maxRounds = 20;

    while (maxRounds-- > 0) {
      const readyTasks = globalTracker.getReadyTasks();
      if (readyTasks.length === 0) break;

      console.log(`[Orchestrator] Executing ${readyTasks.length} tasks in parallel...\n`);

      if (sendEvent) {
        sendEvent({ type: "tasks_start", tasks: readyTasks.map((t) => ({ id: t.id, name: t.name })) });
      }

      const promises = readyTasks.map(async (task) => {
        globalTracker.updateStatus(task.id, "in_progress");

        if (sendEvent) {
          sendEvent({ type: "task_start", taskId: task.id, taskName: task.name });
        }

        try {
          const context = {
            projectInfo: globalStore.getProjectInfo(sessionId),
            completedTasks: results,
          };

          let result;
          const useHermesCli = this.builderEngine === "hermes-cli" || task.agent === "hermes-cli";
          const useCodex = this.builderEngine === "codex" || task.agent === "codex";
          const useClaude = this.builderEngine === "claude" || task.agent === "claude";
          const useMimo = this.builderEngine === "mimo" || task.agent === "mimo";
          const useMistral = this.builderEngine === "mistral" || task.agent === "mistral";
          const useTogether = this.builderEngine === "together" || task.agent === "together";

          if (useHermesCli) {
            console.log(`[Orchestrator] Using Hermes CLI for task ${task.id}`);
            result = await this.hermesAgent.execute(task, { background: false });
          } else if (useCodex) {
            console.log(`[Orchestrator] Using Codex for task ${task.id}`);
            result = await this.codex.execute(task, { background: false });
          } else if (useClaude) {
            console.log(`[Orchestrator] Using Claude Code for task ${task.id}`);
            result = await this.claude.execute(task, { background: false });
          } else if (useMimo) {
            console.log(`[Orchestrator] Using MiMo for task ${task.id}`);
            result = await this.mimo.implement(task, context);
          } else if (useMistral) {
            console.log(`[Orchestrator] Using Mistral for task ${task.id}`);
            result = await this.implementWithMistral(task, context);
          } else if (useTogether) {
            console.log(`[Orchestrator] Using Together for task ${task.id}`);
            result = await this.implementWithTogether(task, context);
          } else {
            result = await this.builder.implement(task, context);
          }

          globalTracker.updateStatus(task.id, "done", { result });
          globalStore.addResult(sessionId, result);

          if (this.persistent) {
            this.persistent.saveTask({
              id: task.id,
              name: task.name,
              status: "done",
              result,
              completedAt: Date.now(),
            });
          }

          console.log(`[Orchestrator] Task ${task.id} completed\n`);

          if (sendEvent) {
            sendEvent({ type: "task_complete", taskId: task.id, result });
          }

          return result;
        } catch (error) {
          globalTracker.updateStatus(task.id, "failed", { error: error.message });
          console.error(`[Orchestrator] Task ${task.id} failed: ${error.message}\n`);

          if (sendEvent) {
            sendEvent({ type: "task_error", taskId: task.id, error: error.message });
          }

          return { agent: task.agent, error: error.message, taskId: task.id };
        }
      });

      const roundResults = await Promise.all(promises);
      results.push(...roundResults);
    }

    return results;
  }

  async fixIssues(issues, previousResults, sendEvent = null) {
    const results = [];

    for (const issue of issues) {
      if (issue.severity === "minor") continue;

      const fixTask = {
        id: `fix_${issue.file}_${Date.now()}`,
        name: `Fix: ${issue.description}`,
        description: `Fix the following issue:\n\nFile: ${issue.file}\nLine: ${issue.line || "N/A"}\nIssue: ${issue.description}\n\nSuggestion: ${issue.suggestion}`,
        agent: "builder",
      };

      globalTracker.updateStatus(fixTask.id, "in_progress");

      if (sendEvent) {
        sendEvent({ type: "fix_start", taskId: fixTask.id, issue });
      }

      try {
        const result = await this.builder.implement(fixTask, { previousResults });
        globalTracker.updateStatus(fixTask.id, "done", { result });
        results.push(result);

        if (sendEvent) {
          sendEvent({ type: "fix_complete", taskId: fixTask.id });
        }
      } catch (error) {
        globalTracker.updateStatus(fixTask.id, "failed", { error: error.message });

        if (sendEvent) {
          sendEvent({ type: "fix_error", taskId: fixTask.id, error: error.message });
        }
      }
    }

    return results;
  }

  async implementWithMistral(task, context = {}) {
    const prompt = `Task: ${task.name}\n\nDescription: ${task.description}\n\nPlease implement this task.`;

    try {
      const response = await this.mistral.code(prompt);
      const content = response.choices?.[0]?.message?.content || "No response";

      return {
        agent: "mistral",
        taskId: task.id,
        response: content,
        files: [],
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new Error(`Mistral implementation failed: ${error.message}`);
    }
  }

  async implementWithTogether(task, context = {}) {
    const prompt = `Task: ${task.name}\n\nDescription: ${task.description}\n\nPlease implement this task.`;

    try {
      const response = await this.together.code(prompt);
      const content = response.choices?.[0]?.message?.content || "No response";

      return {
        agent: "together",
        taskId: task.id,
        response: content,
        files: [],
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new Error(`Together implementation failed: ${error.message}`);
    }
  }

  summarize(results, review) {
    const successful = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);

    return {
      status: failed.length === 0 ? "success" : "partial",
      tasksCompleted: successful.length,
      tasksFailed: failed.length,
      reviewStatus: review?.approved ? "approved" : "needs_review",
      issues: review?.issues?.length || 0,
      summary: results.map((r) => r.response?.slice(0, 200)).filter(Boolean),
    };
  }

  getStatus() {
    return {
      tasks: globalTracker.getStats(),
      timeline: globalTracker.getTimeline(),
    };
  }
}
