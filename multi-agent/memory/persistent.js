import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { resolve, join } from "path";

export class PersistentStore {
  constructor(dataDir = "./data") {
    this.dataDir = resolve(dataDir);
    this.memoryDir = join(this.dataDir, "memory");
    this.sessionsDir = join(this.dataDir, "sessions");
    this.tasksDir = join(this.dataDir, "tasks");

    this.ensureDirs();
  }

  ensureDirs() {
    for (const dir of [this.dataDir, this.memoryDir, this.sessionsDir, this.tasksDir]) {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    }
  }

  // Session persistence
  saveSession(session) {
    const path = join(this.sessionsDir, `${session.id}.json`);
    writeFileSync(path, JSON.stringify(session, null, 2));
  }

  loadSession(sessionId) {
    const path = join(this.sessionsDir, `${sessionId}.json`);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf-8"));
  }

  listSessions() {
    return readdirSync(this.sessionsDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  }

  // Task persistence
  saveTask(task) {
    const path = join(this.tasksDir, `${task.id}.json`);
    writeFileSync(path, JSON.stringify(task, null, 2));
  }

  loadTask(taskId) {
    const path = join(this.tasksDir, `${taskId}.json`);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf-8"));
  }

  listTasks() {
    return readdirSync(this.tasksDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const task = JSON.parse(readFileSync(join(this.tasksDir, f), "utf-8"));
        return task;
      });
  }

  // Memory (key-value store)
  saveMemory(key, value) {
    const path = join(this.memoryDir, `${key.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
    writeFileSync(path, JSON.stringify({ key, value, updatedAt: Date.now() }, null, 2));
  }

  loadMemory(key) {
    const path = join(this.memoryDir, `${key.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
    if (!existsSync(path)) return null;
    const data = JSON.parse(readFileSync(path, "utf-8"));
    return data.value;
  }

  listMemory() {
    return readdirSync(this.memoryDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const data = JSON.parse(readFileSync(join(this.memoryDir, f), "utf-8"));
        return { key: data.key, updatedAt: data.updatedAt };
      });
  }

  // Cleanup
  clearSession(sessionId) {
    const path = join(this.sessionsDir, `${sessionId}.json`);
    if (existsSync(path)) {
      const { unlinkSync } = require("fs");
      unlinkSync(path);
    }
  }

  getStats() {
    return {
      sessions: this.listSessions().length,
      tasks: this.listTasks().length,
      memoryEntries: this.listMemory().length,
    };
  }
}

let globalPersistent = null;

export function getPersistentStore(dataDir) {
  if (!globalPersistent) {
    globalPersistent = new PersistentStore(dataDir);
  }
  return globalPersistent;
}
