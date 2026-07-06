#!/usr/bin/env node

import { createOpencode, createOpencodeClient } from "@mimo-ai/sdk";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));

class MiMoDevAssistant {
  constructor(options = {}) {
    this.projectDir = options.projectDir || process.cwd();
    this.serverUrl = options.serverUrl || null;
    this.server = null;
    this.client = null;
    this.sessionId = null;
  }

  async init() {
    if (this.serverUrl) {
      this.client = createOpencodeClient({
        baseUrl: this.serverUrl,
        directory: this.projectDir,
      });
    } else {
      const result = await createOpencode({
        port: 0,
        config: { directory: this.projectDir },
      });
      this.server = result.server;
      this.client = result.client;
      this.serverUrl = result.server.url;
    }

    const session = await this.client.session.create();
    this.sessionId = session.data.id;
    return this;
  }

  async prompt(message, options = {}) {
    const { files = [], agent = "build" } = options;

    let fullPrompt = message;

    if (files.length > 0) {
      const fileContents = [];
      for (const file of files) {
        const filePath = resolve(this.projectDir, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, "utf-8");
          fileContents.push(`--- ${file} ---\n${content}`);
        }
      }
      if (fileContents.length > 0) {
        fullPrompt += "\n\nФайлы проекта:\n" + fileContents.join("\n\n");
      }
    }

    const result = await this.client.session.prompt({
      path: { id: this.sessionId },
      body: { content: fullPrompt, agent },
    });

    return result.data;
  }

  async getMessages() {
    const result = await this.client.session.messages({
      path: { id: this.sessionId },
    });
    return result.data;
  }

  async listSessions() {
    const result = await this.client.session.list();
    return result.data;
  }

  async listFiles(dir = ".") {
    const result = await this.client.file.list({
      path: { directory: dir },
    });
    return result.data;
  }

  async readFile(filePath) {
    const result = await this.client.file.read({
      path: { path: filePath },
    });
    return result.data;
  }

  async getDiff() {
    const result = await this.client.session.diff({
      path: { id: this.sessionId },
    });
    return result.data;
  }

  async abort() {
    await this.client.session.abort({
      path: { id: this.sessionId },
    });
  }

  async close() {
    if (this.server) {
      this.server.close();
    }
  }
}

async function interactiveMode() {
  const assistant = new MiMoDevAssistant();
  await assistant.init();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n=== MiMo Dev Assistant ===");
  console.log("Введите задачу для разработки (или 'exit' для выхода)\n");

  const ask = () => {
    rl.question(" > ", async (input) => {
      const trimmed = input.trim();
      if (trimmed === "exit" || trimmed === "quit") {
        await assistant.close();
        rl.close();
        return;
      }

      if (trimmed === "diff") {
        const diff = await assistant.getDiff();
        console.log("\n--- Diff ---");
        console.log(JSON.stringify(diff, null, 2));
        ask();
        return;
      }

      if (trimmed === "messages") {
        const messages = await assistant.getMessages();
        console.log("\n--- Messages ---");
        for (const msg of messages) {
          console.log(`[${msg.role}] ${msg.content?.slice(0, 200)}...`);
        }
        ask();
        return;
      }

      if (trimmed.startsWith("file ")) {
        const filePath = trimmed.slice(5).trim();
        const content = await assistant.readFile(filePath);
        console.log("\n--- File Content ---");
        console.log(content);
        ask();
        return;
      }

      if (trimmed.startsWith("files")) {
        const dir = trimmed.slice(5).trim() || ".";
        const files = await assistant.listFiles(dir);
        console.log("\n--- Files ---");
        console.log(JSON.stringify(files, null, 2));
        ask();
        return;
      }

      if (trimmed === "help") {
        console.log("\nКоманды:");
        console.log("  exit/quit - выход");
        console.log("  diff - показать изменения");
        console.log("  messages - показать историю");
        console.log("  file <path> - прочитать файл");
        console.log("  files [dir] - список файлов");
        console.log("  help - эта справка\n");
        ask();
        return;
      }

      try {
        console.log("\nОбрабатываю...");
        await assistant.prompt(trimmed);
        const messages = await assistant.getMessages();
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.content) {
          console.log("\n--- Ответ ---");
          console.log(lastMsg.content);
        }
      } catch (err) {
        console.error("Ошибка:", err.message);
      }
      console.log();
      ask();
    });
  };

  ask();
}

async function singlePromptMode(promptText, options = {}) {
  const assistant = new MiMoDevAssistant({
    projectDir: options.dir || process.cwd(),
  });
  await assistant.init();

  try {
    const files = options.files || [];
    await assistant.prompt(promptText, { files });

    const messages = await assistant.getMessages();
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.content) {
      console.log(lastMsg.content);
    }

    if (options.showDiff) {
      const diff = await assistant.getDiff();
      console.log("\n--- Diff ---");
      console.log(JSON.stringify(diff, null, 2));
    }
  } finally {
    await assistant.close();
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    interactive: false,
    prompt: null,
    files: [],
    dir: null,
    showDiff: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--interactive":
      case "-i":
        options.interactive = true;
        break;
      case "--prompt":
      case "-p":
        options.prompt = args[++i];
        break;
      case "--file":
      case "-f":
        options.files.push(args[++i]);
        break;
      case "--dir":
      case "-d":
        options.dir = args[++i];
        break;
      case "--diff":
        options.showDiff = true;
        break;
      case "--help":
      case "-h":
        console.log(`
MiMo Dev Assistant

Использование:
  node index.js                          Интерактивный режим
  node index.js -p "задача"              Одиночный запрос
  node index.js -p "задача" -f file.js   С указанием файла
  node index.js -p "задача" -d ./src     В директории проекта
  node index.js -p "задача" --diff       Показать изменения

Команды в интерактивном режиме:
  exit/quit  Выход
  diff       Показать изменения
  messages   История сообщений
  file <p>   Прочитать файл
  files [d]  Список файлов
  help       Справка
`);
        process.exit(0);
    }
  }

  return options;
}

const options = parseArgs();

if (options.prompt) {
  singlePromptMode(options.prompt, options).catch(console.error);
} else {
  interactiveMode().catch(console.error);
}

export { MiMoDevAssistant };
