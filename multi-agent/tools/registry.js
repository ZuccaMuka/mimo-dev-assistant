import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { execSync } from "child_process";
import { createOpencode } from "@mimo-ai/sdk";

let projectRoot = process.cwd();

export function setProjectRoot(dir) {
  projectRoot = dir;
}

export function getProjectRoot() {
  return projectRoot;
}

export const tools = [
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

export function getToolsForAgent(agentName) {
  const toolMap = {
    planner: ["read_file", "list_files", "search"],
    builder: ["read_file", "write_file", "list_files", "bash", "search"],
    reviewer: ["read_file", "list_files", "search", "bash"],
  };

  const allowed = toolMap[agentName] || [];
  return tools.filter((t) => allowed.includes(t.function.name));
}

export async function callHermes(messages, toolsForRequest = null, customModel = null, customUrl = null) {
  const hermesUrl = customUrl || process.env.HERMES_URL || "http://localhost:11434";
  const model = customModel || process.env.MODEL || "gemma";

  const payload = {
    model,
    messages,
    stream: false,
  };

  if (toolsForRequest && toolsForRequest.length > 0) {
    payload.tools = toolsForRequest;
  }

  const response = await fetch(`${hermesUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Hermes API error: ${response.status}`);
  }

  return await response.json();
}

export async function callHermesStream(messages, toolsForRequest = null, customModel = null, customUrl = null) {
  const hermesUrl = customUrl || process.env.HERMES_URL || "http://localhost:11434";
  const model = customModel || process.env.MODEL || "gemma";

  const payload = {
    model,
    messages,
    stream: true,
  };

  if (toolsForRequest && toolsForRequest.length > 0) {
    payload.tools = toolsForRequest;
  }

  const response = await fetch(`${hermesUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Hermes API error: ${response.status}`);
  }

  return response.body;
}

export function createProvider(config) {
  return {
    url: config.url || process.env.HERMES_URL || "http://localhost:11434",
    model: config.model || process.env.MODEL || "gemma",
    name: config.name || "default",

    async chat(messages, tools = null) {
      return callHermes(messages, tools, this.model, this.url);
    },

    async chatStream(messages, tools = null) {
      return callHermesStream(messages, tools, this.model, this.url);
    },
  };
}

// ==================== MIMO PROVIDER ====================

let mimoClient = null;
let mimoSessionId = null;

async function initMimo(projectDir) {
  if (mimoClient) return { client: mimoClient, sessionId: mimoSessionId };

  try {
    const { client, server } = await createOpencode({
      port: 0,
      config: { directory: projectDir || projectRoot },
      timeout: 15000,
    });
    mimoClient = client;
    mimoClient._server = server;

    const session = await client.session.create();
    mimoSessionId = session.data.id;

    console.log("[MiMo] SDK initialized, session:", mimoSessionId);
    return { client: mimoClient, sessionId: mimoSessionId };
  } catch (err) {
    console.error("[MiMo] Init failed:", err.message);
    return null;
  }
}

export async function callMimo(prompt, options = {}) {
  const { files = [], agent = "build", projectDir } = options;

  const mimo = await initMimo(projectDir);
  if (!mimo) {
    throw new Error("MiMo SDK not available");
  }

  let fullPrompt = prompt;
  if (files.length > 0) {
    const fileContents = [];
    for (const file of files) {
      const filePath = resolve(projectDir || projectRoot, file);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, "utf-8");
        fileContents.push(`--- ${file} ---\n${content}`);
      }
    }
    if (fileContents.length > 0) {
      fullPrompt += "\n\nФайлы проекта:\n" + fileContents.join("\n\n");
    }
  }

  await mimo.client.session.prompt({
    path: { id: mimo.sessionId },
    body: { content: fullPrompt, agent },
  });

  const messages = await mimo.client.session.messages({
    path: { id: mimo.sessionId },
  });

  const lastMsg = messages.data?.[messages.data.length - 1];

  // Return in Hermes-compatible format
  return {
    choices: [{
      message: {
        role: "assistant",
        content: lastMsg?.content || "No response",
      },
    }],
  };
}

export function createMimoProvider(config = {}) {
  return {
    name: config.name || "mimo",

    async chat(prompt, options = {}) {
      const result = await callMimo(prompt, options);
      return result.choices?.[0]?.message?.content || "No response";
    },
  };
}
