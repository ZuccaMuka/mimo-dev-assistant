#!/usr/bin/env node

import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Mock Hermes/Ollama API
let callCount = 0;

app.post("/v1/chat/completions", (req, res) => {
  const { messages, tools } = req.body;
  const lastMsg = messages?.[messages.length - 1];

  console.log(`[Mock Hermes] Received: ${lastMsg?.content?.slice(0, 50) || "tool call"}`);

  // If tools are provided, simulate a tool call on first call, then respond
  if (tools && tools.length > 0) {
    callCount++;

    // First call: use a tool
    if (callCount <= 1) {
      return res.json({
        choices: [{
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "call_1",
              type: "function",
              function: {
                name: "list_files",
                arguments: JSON.stringify({ path: "." })
              }
            }]
          }
        }]
      });
    }

    // Subsequent calls: provide text response
    callCount = 0;
    return res.json({
      choices: [{
        message: {
          role: "assistant",
          content: "I found the following files in the current directory. The task is complete."
        }
      }]
    });
  }

  // Simple text response
  res.json({
    choices: [{
      message: {
        role: "assistant",
        content: `Mock response from Hermes/Gemma. You said: "${lastMsg?.content || "no content"}"`
      }
    }]
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", model: "mock-gemma" });
});

const PORT = 11434;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Mock Hermes running on http://localhost:${PORT}`);
});
