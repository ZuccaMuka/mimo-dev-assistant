#!/usr/bin/env node

import { CodexAgent } from "./agents/codex.js";

async function testCodex() {
  console.log("=== Testing Codex Integration ===\n");

  const codex = new CodexAgent({
    projectDir: "/tmp/codex-test",
    mode: "full-auto",
  });

  // Check status
  console.log("1. Checking Codex status...");
  const status = codex.getStatus();
  console.log("Status:", status);

  if (!status.installed) {
    console.error("Codex not installed!");
    process.exit(1);
  }

  // Create test directory
  const fs = await import("fs");
  if (!fs.existsSync("/tmp/codex-test")) {
    fs.mkdirSync("/tmp/codex-test", { recursive: true });
  }

  // Test simple task
  console.log("\n2. Testing simple task...");
  const result = await codex.execute({
    name: "Create hello world",
    description: "Create a simple hello.js file with Hello World",
  });

  console.log("\nResult:", result);

  console.log("\n=== Test Complete ===");
}

testCodex().catch(console.error);
