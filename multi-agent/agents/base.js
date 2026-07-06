import { callHermes, callHermesStream } from "../tools/registry.js";
import { StreamHandler } from "./base-stream.js";
import { getPersistentStore } from "../memory/persistent.js";

export class Agent {
  constructor(name, config = {}) {
    this.name = name;
    this.systemPrompt = config.systemPrompt || "";
    this.allowedTools = config.allowedTools || [];
    this.maxIterations = config.maxIterations || 10;
    this.model = config.model || null;
    this.hermesUrl = config.hermesUrl || null;
    this.subAgents = new Map();
    this.parentAgent = config.parentAgent || null;
    this.depth = config.depth || 0;
    this.maxDepth = config.maxDepth || 3;
    this.persistent = config.persistent || null;
  }

  registerSubAgent(name, agent) {
    this.subAgents.set(name, agent);
  }

  async think(messages, tools = null, stream = false) {
    const toolSet = tools || this.allowedTools;

    if (stream) {
      return await callHermesStream(messages, toolSet.length > 0 ? toolSet : null, this.model, this.hermesUrl);
    }

    const result = await callHermes(messages, toolSet.length > 0 ? toolSet : null, this.model, this.hermesUrl);
    return result.choices?.[0]?.message;
  }

  async spawnSubAgent(task, agentName = "builder") {
    if (this.depth >= this.maxDepth) {
      console.log(`[${this.name}] Max subagent depth reached, executing directly`);
      return null;
    }

    const SubAgentClass = this.subAgents.get(agentName);
    if (!SubAgentClass) return null;

    const subAgent = new SubAgentClass({
      depth: this.depth + 1,
      parentAgent: this.name,
      persistent: this.persistent,
    });

    console.log(`[${this.name}] Spawning sub-agent: ${agentName}`);
    return await subAgent.run(task);
  }

  async run(task, context = {}, streamResponse = null) {
    const messages = [
      { role: "system", content: this.systemPrompt },
    ];

    if (context.projectInfo) {
      messages.push({
        role: "system",
        content: `Project context:\n${JSON.stringify(context.projectInfo, null, 2)}`,
      });
    }

    if (task.context) {
      messages.push({
        role: "system",
        content: `Previous results:\n${JSON.stringify(task.context, null, 2)}`,
      });
    }

    messages.push({ role: "user", content: task.prompt });

    const streamHandler = streamResponse ? new StreamHandler(streamResponse) : null;

    if (streamHandler) {
      streamHandler.sendEvent({ type: "agent_start", agent: this.name });
    }

    for (let i = 0; i < this.maxIterations; i++) {
      if (streamHandler) {
        streamHandler.sendEvent({ type: "iteration", iteration: i + 1 });
      }

      const response = await this.think(messages, null, !!streamHandler);

      if (!response) break;

      if (!response.tool_calls || response.tool_calls.length === 0) {
        const result = {
          agent: this.name,
          response: response.content || "",
          iterations: i + 1,
          timestamp: Date.now(),
        };

        if (this.persistent) {
          this.persistent.saveTask({
            id: `result_${this.name}_${Date.now()}`,
            ...result,
          });
        }

        if (streamHandler) {
          streamHandler.sendEvent({ type: "agent_complete", agent: this.name, result });
          streamHandler.close();
        }

        return result;
      }

      messages.push(response);

      for (const toolCall of response.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs;
        try {
          fnArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          fnArgs = {};
        }

        if (streamHandler) {
          streamHandler.sendEvent({ type: "tool_call", tool: fnName, args: fnArgs });
        }

        console.log(`[${this.name}] ${fnName}(${JSON.stringify(fnArgs).slice(0, 80)})`);

        const { executeTool } = await import("../tools/executor.js");
        const result = executeTool(fnName, fnArgs);

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });

        if (streamHandler) {
          streamHandler.sendEvent({ type: "tool_result", tool: fnName, result });
        }
      }
    }

    const result = {
      agent: this.name,
      response: "Max iterations reached",
      iterations: this.maxIterations,
    };

    if (streamHandler) {
      streamHandler.sendEvent({ type: "agent_complete", agent: this.name, result });
      streamHandler.close();
    }

    return result;
  }
}
