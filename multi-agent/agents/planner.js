import { Agent } from "./base.js";

const PLANNER_PROMPT = `You are a software project planner. Your job is to analyze user requests and create a structured task breakdown.

When given a request:
1. Understand what the user wants to build
2. Break it into concrete, actionable tasks
3. Identify dependencies between tasks
4. Output a JSON task list

Output format (strict JSON):
{
  "tasks": [
    {
      "id": "T1",
      "name": "Task name",
      "description": "What to do",
      "dependsOn": [],
      "agent": "builder",
      "tools": ["read_file", "write_file", "bash"]
    }
  ]
}

Rules:
- Tasks should be atomic (one clear action)
- Include all necessary steps (structure, code, tests)
- Mark dependencies correctly
- Assign to appropriate agent (builder for code, tester for tests)
- Keep tasks small and focused`;

export class PlannerAgent extends Agent {
  constructor(config = {}) {
    super("planner", {
      systemPrompt: PLANNER_PROMPT,
      allowedTools: ["read_file", "list_files", "search"],
      ...config,
    });
  }

  async analyze(userRequest, projectInfo = null) {
    const task = {
      prompt: `Analyze this request and create a task breakdown:\n\n${userRequest}`,
      context: null,
    };

    const context = {};
    if (projectInfo) {
      context.projectInfo = projectInfo;
    }

    const result = await this.run(task, context);

    try {
      const jsonMatch = result.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("[Planner] Failed to parse task list:", e.message);
    }

    return {
      tasks: [
        {
          id: "T1",
          name: "Implement request",
          description: userRequest,
          dependsOn: [],
          agent: "builder",
          tools: ["read_file", "write_file", "list_files", "bash", "search"],
        },
      ],
    };
  }
}
