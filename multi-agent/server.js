#!/usr/bin/env node

import express from "express";
import cors from "cors";
import { Orchestrator } from "./orchestrator.js";
import { globalTracker } from "./memory/tasks.js";
import { globalStore } from "./memory/store.js";
import { getPersistentStore } from "./memory/persistent.js";
import { createServer } from "http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(join(__dirname, "public")));

// Increase timeout for long-running requests (Claude Code can take 60-120s)
const server = createServer(app);
server.timeout = 300000; // 5 minutes
server.keepAliveTimeout = 300000;
server.headersTimeout = 300000;

const dataDir = process.env.DATA_DIR || "./data";
const persistent = getPersistentStore(dataDir);

const orchestrator = new Orchestrator({
  projectDir: process.env.PROJECT_DIR || process.cwd(),
  persistent,
  builderEngine: process.env.BUILDER_ENGINE || "hermes-cli", // "hermes-cli", "hermes", "codex", "mimo", "claude", "mistral", "together"
});

// List agents
app.get("/v1/agents", (req, res) => {
  res.json({
    agents: [
      { name: "planner", description: "Analyzes requests and creates task breakdowns", tools: ["read_file", "list_files", "search"] },
      { name: "builder", description: "Implements code based on task descriptions (Hermes/Gemma)", tools: ["read_file", "write_file", "list_files", "bash", "search"] },
      { name: "hermes-cli", description: "Implements code using Hermes Agent CLI (Groq/LLaMA)", tools: ["read_file", "write_file", "list_files", "bash", "search"] },
      { name: "codex", description: "Implements code using OpenAI Codex CLI", tools: ["codex_exec", "codex_review"] },
      { name: "claude", description: "Implements code using Claude Code CLI (Anthropic)", tools: ["read_file", "write_file", "list_files", "bash", "search"] },
      { name: "mimo", description: "Implements code using MiMo SDK", tools: ["read_file", "write_file", "list_files", "bash", "search"] },
      { name: "reviewer", description: "Reviews code quality and suggests improvements", tools: ["read_file", "list_files", "search", "bash"] },
    ],
    builderEngine: process.env.BUILDER_ENGINE || "hermes-cli",
  });
});

// Process request (non-streaming)
app.post("/v1/process", async (req, res) => {
  try {
    const { prompt, options } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    console.log(`[API] Processing: "${prompt.slice(0, 50)}..."`);
    const result = await orchestrator.handleRequest(prompt, options);
    res.json(result);
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Process request (streaming with SSE)
app.post("/v1/process/stream", async (req, res) => {
  try {
    const { prompt, options } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    console.log(`[API] Streaming: "${prompt.slice(0, 50)}..."`);

    const result = await orchestrator.handleRequest(prompt, { ...options, streamResponse: res });

    res.write(`data: ${JSON.stringify({ type: "complete", result })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Error:", err.message);
    res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
    res.end();
  }
});

// Get task status
app.get("/v1/tasks", (req, res) => {
  res.json({
    stats: globalTracker.getStats(),
    tasks: globalTracker.getAllTasks(),
  });
});

// Get task by ID
app.get("/v1/tasks/:id", (req, res) => {
  const task = globalTracker.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }
  res.json(task);
});

// Get timeline
app.get("/v1/timeline", (req, res) => {
  res.json({
    timeline: globalTracker.getTimeline(),
  });
});

// Codex-specific endpoints
app.get("/v1/codex/status", (req, res) => {
  res.json(orchestrator.codex.getStatus());
});

app.post("/v1/codex/execute", async (req, res) => {
  try {
    const { task, options } = req.body;
    if (!task) {
      return res.status(400).json({ error: "No task provided" });
    }
    const result = await orchestrator.codex.execute(task, options);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/v1/codex/review", async (req, res) => {
  try {
    const { prNumber } = req.body;
    const result = await orchestrator.codex.review(prNumber);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/v1/codex/fix-issue", async (req, res) => {
  try {
    const { issueNumber, description } = req.body;
    const result = await orchestrator.codex.fixIssue(issueNumber, description);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Claude Code endpoints
app.get("/v1/claude/status", (req, res) => {
  res.json(orchestrator.claude.getStatus());
});

app.post("/v1/claude/execute", async (req, res) => {
  try {
    const { task, options } = req.body;
    if (!task) {
      return res.status(400).json({ error: "No task provided" });
    }
    const result = await orchestrator.claude.execute(task, options);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/v1/claude/review", async (req, res) => {
  try {
    const result = await orchestrator.claude.review();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/v1/claude/fix-issue", async (req, res) => {
  try {
    const { issueNumber, description } = req.body;
    const result = await orchestrator.claude.fixIssue(issueNumber, description);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Persistent memory endpoints
app.get("/v1/memory", (req, res) => {
  res.json({
    entries: persistent.listMemory(),
    stats: persistent.getStats(),
  });
});

app.get("/v1/memory/:key", (req, res) => {
  const value = persistent.loadMemory(req.params.key);
  if (value === null) {
    return res.status(404).json({ error: "Not found" });
  }
  res.json({ key: req.params.key, value });
});

app.post("/v1/memory", (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) {
    return res.status(400).json({ error: "key and value required" });
  }
  persistent.saveMemory(key, value);
  res.json({ success: true });
});

// Sessions
app.get("/v1/sessions", (req, res) => {
  res.json({ sessions: persistent.listSessions() });
});

app.get("/v1/sessions/:id", (req, res) => {
  const session = persistent.loadSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json(session);
});

// Dashboard
app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "public", "index.html"));
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    projectDir: process.env.PROJECT_DIR || process.cwd(),
    hermesUrl: process.env.HERMES_URL || "http://localhost:11434",
    model: process.env.MODEL || "gemma",
    dataDir,
    stats: persistent.getStats(),
  });
});

// Providers
app.get("/v1/providers", (req, res) => {
  res.json({
    providers: [
      {
        name: "hermes",
        description: "Hermes/Gemma via local Ollama",
        available: true,
        models: ["gemma"],
      },
      {
        name: "codex",
        description: "OpenAI Codex CLI",
        available: true,
        models: ["codex-latest"],
      },
      {
        name: "claude",
        description: "Claude Code CLI (Anthropic subscription)",
        available: orchestrator.claude.getStatus().installed,
        models: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-3-5-sonnet-20241022"],
      },
      {
        name: "mimo",
        description: "MiMo SDK",
        available: true,
        models: ["mimo-latest"],
      },
      {
        name: "mistral",
        description: "Mistral AI",
        available: orchestrator.mistral.isAvailable(),
        models: orchestrator.mistral.getModels(),
      },
      {
        name: "together",
        description: "Together.ai",
        available: orchestrator.together.isAvailable(),
        models: orchestrator.together.getModels(),
      },
      {
        name: "replicate",
        description: "Replicate (image/video generation)",
        available: orchestrator.replicate.isAvailable(),
      },
    ],
  });
});

// Media endpoints
app.post("/v1/media/generate", async (req, res) => {
  try {
    const { prompt, options } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }
    const result = await orchestrator.mediaGenerator.generateImage(prompt, options);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/v1/media/video", async (req, res) => {
  try {
    const { prompt, options } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }
    const result = await orchestrator.mediaGenerator.generateVideo(prompt, options);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/v1/media/edit", async (req, res) => {
  try {
    const { imageUrl, prompt, options } = req.body;
    if (!imageUrl || !prompt) {
      return res.status(400).json({ error: "imageUrl and prompt required" });
    }
    const result = await orchestrator.mediaGenerator.editMedia(imageUrl, prompt, options);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Video editing endpoints
app.post("/v1/video/concat", async (req, res) => {
  try {
    const { files, output } = req.body;
    if (!files || !Array.isArray(files) || files.length < 2) {
      return res.status(400).json({ error: "At least 2 files required" });
    }
    const result = await orchestrator.videoEditor.concatVideos(files, output || "concatenated.mp4");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/v1/video/trim", async (req, res) => {
  try {
    const { file, start, duration, output } = req.body;
    if (!file || start === undefined || duration === undefined) {
      return res.status(400).json({ error: "file, start, and duration required" });
    }
    const result = await orchestrator.videoEditor.trimVideo(file, start, duration, output || "trimmed.mp4");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/v1/video/resize", async (req, res) => {
  try {
    const { file, width, height, output } = req.body;
    if (!file || !width || !height) {
      return res.status(400).json({ error: "file, width, and height required" });
    }
    const result = await orchestrator.videoEditor.resizeVideo(file, width, height, output || "resized.mp4");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/v1/video/text", async (req, res) => {
  try {
    const { file, text, output, options } = req.body;
    if (!file || !text) {
      return res.status(400).json({ error: "file and text required" });
    }
    const result = await orchestrator.videoEditor.addTextOverlay(file, text, output || "text-overlay.mp4", options);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`
=== Hermes Multi-Agent Server ===

Server:      http://0.0.0.0:${PORT}
Hermes:      ${process.env.HERMES_URL || "http://localhost:11434"}
Model:       ${process.env.MODEL || "gemma"}
Builder:     ${process.env.BUILDER_ENGINE || "hermes"}
Project:     ${process.env.PROJECT_DIR || process.cwd()}
Data:        ${dataDir}

Endpoints:
  GET  /v1/agents           - List agents
  POST /v1/process          - Process request
  POST /v1/process/stream   - Process with streaming (SSE)
  GET  /v1/tasks            - List tasks
  GET  /v1/tasks/:id        - Get task
  GET  /v1/timeline         - Get timeline
  GET  /v1/memory           - List memory
  GET  /v1/memory/:key      - Get memory
  POST /v1/memory           - Save memory
  GET  /v1/sessions         - List sessions
  GET  /v1/sessions/:id     - Get session
  GET  /v1/providers        - List providers
  POST /v1/media/generate   - Generate image
  POST /v1/media/video      - Generate video
  POST /v1/media/edit       - Edit media
  POST /v1/video/concat     - Concatenate videos
  POST /v1/video/trim       - Trim video
  POST /v1/video/resize     - Resize video
  POST /v1/video/text       - Add text overlay
  GET  /v1/codex/status     - Codex status
  POST /v1/codex/execute    - Execute with Codex
  POST /v1/codex/review     - Review PR with Codex
  POST /v1/codex/fix-issue  - Fix issue with Codex
  GET  /v1/claude/status    - Claude Code status
  POST /v1/claude/execute   - Execute with Claude Code
  POST /v1/claude/review    - Review with Claude Code
  POST /v1/claude/fix-issue - Fix issue with Claude Code
  GET  /health              - Health check
`);
});
