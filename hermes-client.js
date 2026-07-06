#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import readline from "readline";

class HermesDevClient {
  constructor(options = {}) {
    this.serverUrl = options.serverUrl || "http://localhost:3000";
    this.projectDir = options.projectDir || process.cwd();
    this.backend = options.backend || "hermes"; // "hermes" or "mimo"
  }

  async chat(prompt, options = {}) {
    const { useAgent = true, maxIterations = 10, files = [] } = options;

    // Use MiMo backend
    if (this.backend === "mimo") {
      return this.mimo(prompt, { files });
    }

    if (useAgent) {
      return this.agent(prompt, maxIterations);
    }

    const response = await fetch(`${this.serverUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "No response";
  }

  async mimo(prompt, options = {}) {
    const { files = [], agent = "build" } = options;

    const response = await fetch(`${this.serverUrl}/v1/mimo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, files, agent }),
    });

    const data = await response.json();
    return data.response || "No response";
  }

  async mimoDiff() {
    const response = await fetch(`${this.serverUrl}/v1/mimo/diff`);
    return await response.json();
  }

  async mimoReset() {
    const response = await fetch(`${this.serverUrl}/v1/mimo/reset`, {
      method: "POST",
    });
    return await response.json();
  }

  async agent(prompt, maxIterations = 10) {
    const response = await fetch(`${this.serverUrl}/v1/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, maxIterations }),
    });

    return await response.json();
  }

  async listModels() {
    const response = await fetch(`${this.serverUrl}/v1/models`);
    return await response.json();
  }

  async health() {
    const response = await fetch(`${this.serverUrl}/health`);
    return await response.json();
  }
}

async function interactiveMode() {
  const client = new HermesDevClient();

  console.log("\n=== Hermes Dev Client ===");
  console.log("Введите задачу (или 'exit' для выхода)\n");

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

      if (trimmed === "health") {
        const health = await client.health();
        console.log(JSON.stringify(health, null, 2));
        ask();
        return;
      }

      if (trimmed === "models") {
        const models = await client.listModels();
        console.log(JSON.stringify(models, null, 2));
        ask();
        return;
      }

      if (trimmed === "help") {
        console.log("\nКоманды:");
        console.log("  exit/quit - выход");
        console.log("  health - проверка сервера");
        console.log("  models - список моделей");
        console.log("  diff - показать изменения MiMo");
        console.log("  reset - сбросить сессию MiMo");
        console.log("  backend [hermes|mimo] - переключить бэкенд");
        console.log("  help - эта справка\n");
        ask();
        return;
      }

      if (trimmed === "diff") {
        const diff = await client.mimoDiff();
        console.log("\n--- Diff ---");
        console.log(JSON.stringify(diff, null, 2));
        ask();
        return;
      }

      if (trimmed === "reset") {
        const result = await client.mimoReset();
        console.log("\n--- Reset ---");
        console.log(JSON.stringify(result, null, 2));
        ask();
        return;
      }

      if (trimmed.startsWith("backend")) {
        const newBackend = trimmed.split(" ")[1];
        if (newBackend === "hermes" || newBackend === "mimo") {
          client.backend = newBackend;
          console.log(`\nБэкенд: ${newBackend}`);
        } else {
          console.log("\nИспользование: backend [hermes|mimo]");
        }
        ask();
        return;
      }

      try {
        console.log("\nОбрабатываю...");
        const result = await client.agent(trimmed);
        console.log("\n--- Ответ ---");
        console.log(result.response);
        console.log(`\n(Итераций: ${result.iterations})`);
      } catch (err) {
        console.error("Ошибка:", err.message);
      }
      console.log();
      ask();
    });
  };

  ask();
}

// CLI
const args = process.argv.slice(2);
const serverUrl = args.find((a) => a.startsWith("--server="))?.split("=")[1] || "http://localhost:3000";
const backend = args.find((a) => a.startsWith("--backend="))?.split("=")[1] || "hermes";
const promptIdx = args.indexOf("--prompt");
const prompt = promptIdx !== -1 ? args[promptIdx + 1] : null;

if (prompt) {
  const client = new HermesDevClient({ serverUrl, backend });
  const result = await client.chat(prompt);
  console.log(result);
} else {
  interactiveMode();
}

export { HermesDevClient };
