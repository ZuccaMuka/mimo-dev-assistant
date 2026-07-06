#!/usr/bin/env node

import express from "express";
import cors from "cors";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "fs";
import { resolve, dirname, join, relative } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { createOpencode } from "@mimo-ai/sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// ==================== CONFIG ====================

const CONFIG = {
  port: process.env.PORT || 3000,
  hermesUrl: process.env.HERMES_URL || "http://localhost:11434",
  projectDir: process.env.PROJECT_DIR || process.cwd(),
  model: process.env.MODEL || "gemma",
};

// ==================== TOOLS ====================

const tools = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read contents of a file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to project root" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to project root" },
          content: { type: "string", description: "File content" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files in a directory",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path (default: root)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bash",
      description: "Execute a bash command",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search",
      description: "Search for text in files",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Search pattern (regex)" },
          path: { type: "string", description: "Directory to search in" },
        },
        required: ["pattern"],
      },
    },
  },
];

// ==================== TOOL EXECUTION ====================

function executeTool(name, args) {
  const projectRoot = CONFIG.projectDir;

  switch (name) {
    case "read_file": {
      const filePath = resolve(projectRoot, args.path);
      if (!existsSync(filePath)) return { error: "File not found" };
      return { content: readFileSync(filePath, "utf-8") };
    }

    case "write_file": {
      const filePath = resolve(projectRoot, args.path);
      const dir = dirname(filePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(filePath, args.content, "utf-8");
      return { success: true, path: args.path };
    }

    case "list_files": {
      const dirPath = resolve(projectRoot, args.path || ".");
      const entries = readdirSync(dirPath).map((name) => {
        const stat = statSync(join(dirPath, name));
        return { name, type: stat.isDirectory() ? "dir" : "file", size: stat.size };
      });
      return { files: entries };
    }

    case "bash": {
      try {
        const output = execSync(args.command, {
          cwd: projectRoot,
          encoding: "utf-8",
          timeout: 30000,
          maxBuffer: 1024 * 1024,
        });
        return { output };
      } catch (err) {
        return { error: err.message, stdout: err.stdout, stderr: err.stderr };
      }
    }

    case "search": {
      try {
        const searchPath = resolve(projectRoot, args.path || ".");
        const output = execSync(
          `rg -n "${args.pattern}" ${searchPath} --max-count 50 2>/dev/null || echo "No matches"`,
          { encoding: "utf-8", timeout: 10000 }
        );
        return { results: output };
      } catch (err) {
        return { results: "No matches found" };
      }
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ==================== HERMES API CLIENT ====================

async function callHermes(messages, toolsForRequest = null) {
  const payload = {
    model: CONFIG.model,
    messages,
    stream: false,
  };

  if (toolsForRequest && toolsForRequest.length > 0) {
    payload.tools = toolsForRequest;
  }

  const response = await fetch(`${CONFIG.hermesUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Hermes API error: ${response.status}`);
  }

  return await response.json();
}

// ==================== AGENT LOOP ====================

async function agentLoop(userMessage, maxIterations = 10) {
  const messages = [
    {
      role: "system",
      content: `You are a software development assistant. You have access to tools for reading/writing files, executing commands, and searching code.

When the user asks you to do something:
1. Think about what needs to be done
2. Use tools to accomplish the task
3. Report results

Always explain what you're doing and show results.`,
    },
    { role: "user", content: userMessage },
  ];

  const conversationHistory = [];

  for (let i = 0; i < maxIterations; i++) {
    const response = await callHermes(messages, tools);
    const choice = response.choices?.[0];

    if (!choice) break;

    const assistantMessage = choice.message;
    conversationHistory.push(assistantMessage);

    // If no tool calls, we're done
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return {
        response: assistantMessage.content,
        history: conversationHistory,
        iterations: i + 1,
      };
    }

    // Execute tool calls
    messages.push(assistantMessage);

    for (const toolCall of assistantMessage.tool_calls) {
      const fnName = toolCall.function.name;
      let fnArgs;
      try {
        fnArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        fnArgs = {};
      }

      console.log(`[Tool] ${fnName}(${JSON.stringify(fnArgs).slice(0, 100)})`);
      const result = executeTool(fnName, fnArgs);

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    response: conversationHistory[conversationHistory.length - 1]?.content || "Max iterations reached",
    history: conversationHistory,
    iterations: maxIterations,
  };
}

// ==================== OPENAI-COMPATIBLE API ====================

// List models
app.get("/v1/models", (req, res) => {
  res.json({
    object: "list",
    data: [
      {
        id: CONFIG.model,
        object: "model",
        owned_by: "hermes",
        permission: [],
      },
    ],
  });
});

// Chat completions (OpenAI compatible)
app.post("/v1/chat/completions", async (req, res) => {
  try {
    const { messages, tools: reqTools, stream } = req.body;
    const lastMessage = messages?.[messages.length - 1];

    if (!lastMessage) {
      return res.status(400).json({ error: "No messages provided" });
    }

    const userContent = lastMessage.content || lastMessage;

    // Check if tools are requested
    const useTools = reqTools && reqTools.length > 0;

    if (useTools) {
      // Forward to Hermes with tools
      const response = await callHermes(messages, reqTools);
      return res.json(response);
    } else {
      // Simple completion without tools
      const response = await callHermes(messages);
      return res.json(response);
    }
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Agent endpoint (uses tool loop)
app.post("/v1/agent", async (req, res) => {
  try {
    const { prompt, maxIterations } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    console.log(`[Agent] ${prompt.slice(0, 100)}...`);
    const result = await agentLoop(prompt, maxIterations || 10);
    res.json(result);
  } catch (err) {
    console.error("Agent error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Tools list
app.get("/v1/tools", (req, res) => {
  res.json({ tools });
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    hermes: CONFIG.hermesUrl,
    model: CONFIG.model,
    project: CONFIG.projectDir,
  });
});

// ==================== MIMO INTEGRATION ====================

let mimoClient = null;
let mimoSessionId = null;

async function initMimo() {
  if (mimoClient) return mimoClient;

  try {
    const { client, server } = await createOpencode({
      port: 0,
      config: { directory: CONFIG.projectDir },
    });
    mimoClient = client;
    mimoClient._server = server;

    const session = await client.session.create();
    mimoSessionId = session.data.id;

    console.log("[MiMo] SDK initialized, session:", mimoSessionId);
    return mimoClient;
  } catch (err) {
    console.error("[MiMo] Init failed:", err.message);
    return null;
  }
}

// MiMo proxy endpoint
app.post("/v1/mimo", async (req, res) => {
  try {
    const { prompt, files = [], agent = "build" } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    const client = await initMimo();
    if (!client) {
      return res.status(503).json({ error: "MiMo SDK not available" });
    }

    // Build prompt with file contents
    let fullPrompt = prompt;
    if (files.length > 0) {
      const fileContents = [];
      for (const file of files) {
        const filePath = resolve(CONFIG.projectDir, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, "utf-8");
          fileContents.push(`--- ${file} ---\n${content}`);
        }
      }
      if (fileContents.length > 0) {
        fullPrompt += "\n\nФайлы проекта:\n" + fileContents.join("\n\n");
      }
    }

    // Send prompt to MiMo
    await client.session.prompt({
      path: { id: mimoSessionId },
      body: { content: fullPrompt, agent },
    });

    // Get response
    const messages = await client.session.messages({
      path: { id: mimoSessionId },
    });

    const lastMsg = messages.data?.[messages.data.length - 1];

    res.json({
      response: lastMsg?.content || "No response",
      session: mimoSessionId,
    });
  } catch (err) {
    console.error("[MiMo] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// MiMo diff endpoint
app.get("/v1/mimo/diff", async (req, res) => {
  try {
    const client = await initMimo();
    if (!client) {
      return res.status(503).json({ error: "MiMo SDK not available" });
    }

    const diff = await client.session.diff({
      path: { id: mimoSessionId },
    });

    res.json(diff.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MiMo reset session
app.post("/v1/mimo/reset", async (req, res) => {
  try {
    const client = await initMimo();
    if (!client) {
      return res.status(503).json({ error: "MiMo SDK not available" });
    }

    const session = await client.session.create();
    mimoSessionId = session.data.id;

    res.json({ session: mimoSessionId, status: "reset" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== START ====================

app.listen(CONFIG.port, "0.0.0.0", () => {
  console.log(`
=== Hermes-MiMo Bridge ===

Server:      http://0.0.0.0:${CONFIG.port}
Hermes:      ${CONFIG.hermesUrl}
Model:       ${CONFIG.model}
Project:     ${CONFIG.projectDir}

Endpoints:
  GET  /v1/models          - List models
  POST /v1/chat/completions - OpenAI-compatible chat
  POST /v1/agent           - Agent with tool use
  POST /v1/mimo            - MiMo SDK proxy
  GET  /v1/mimo/diff       - MiMo changes diff
  POST /v1/mimo/reset      - Reset MiMo session
  GET  /v1/tools           - Available tools
  GET  /health             - Health check
`);
});
