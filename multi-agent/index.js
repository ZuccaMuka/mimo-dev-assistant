#!/usr/bin/env node

import { Orchestrator } from "./orchestrator.js";
import readline from "readline";

async function interactiveMode() {
  const orchestrator = new Orchestrator({
    projectDir: process.env.PROJECT_DIR || process.cwd(),
  });

  console.log("\n=== Hermes Multi-Agent System ===");
  console.log("Agents: planner, builder, reviewer");
  console.log("Enter a task (or 'exit' to quit)\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = () => {
    rl.question(" > ", async (input) => {
      const trimmed = input.trim();
      if (trimmed === "exit" || trimmed === "quit") {
        rl.close();
        return;
      }

      if (trimmed === "status") {
        const status = orchestrator.getStatus();
        console.log("\n--- Status ---");
        console.log(JSON.stringify(status, null, 2));
        ask();
        return;
      }

      if (trimmed === "help") {
        console.log("\nCommands:");
        console.log("  exit/quit  - Exit");
        console.log("  status     - Show task status");
        console.log("  help       - Show this help\n");
        ask();
        return;
      }

      try {
        console.log("\nProcessing...\n");
        const result = await orchestrator.handleRequest(trimmed);

        console.log("\n=== Result ===");
        console.log(JSON.stringify(result.summary, null, 2));
      } catch (err) {
        console.error("Error:", err.message);
      }
      console.log();
      ask();
    });
  };

  ask();
}

async function singleMode(prompt) {
  const orchestrator = new Orchestrator({
    projectDir: process.env.PROJECT_DIR || process.cwd(),
  });

  console.log(`\nProcessing: "${prompt}"\n`);
  const result = await orchestrator.handleRequest(prompt);

  console.log("\n=== Result ===");
  console.log(JSON.stringify(result.summary, null, 2));

  return result;
}

const args = process.argv.slice(2);
const promptIdx = args.indexOf("--prompt");
const prompt = promptIdx !== -1 ? args[promptIdx + 1] : null;

if (prompt) {
  singleMode(prompt).catch(console.error);
} else {
  interactiveMode().catch(console.error);
}

export { Orchestrator };
