import { execSync, spawn } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import { getProjectRoot } from "../tools/registry.js";

const CODEX_PROMPT = `You are an expert software developer using OpenAI Codex.
When given a task:
1. Analyze the request carefully
2. Write clean, production-ready code
3. Follow best practices
4. Create necessary files and structure
5. Test your work when possible

Output format:
After completing the task, provide a summary:
- Files created/modified
- Key decisions made
- Any issues encountered`;

export class CodexAgent {
  constructor(config = {}) {
    this.name = "codex";
    this.projectDir = config.projectDir || getProjectRoot();
    this.mode = config.mode || "full-auto"; // full-auto, yolo, sandbox
    this.maxRetries = config.maxRetries || 2;
    this.persistent = config.persistent || null;
  }

  async execute(task, options = {}) {
    const { background = false, timeout = 120000 } = options;
    const projectRoot = this.projectDir;

    // Ensure we're in a git repo
    this.ensureGitRepo(projectRoot);

    const prompt = this.buildPrompt(task);
    const flags = this.getFlags();
    const command = `codex exec ${flags} "${prompt.replace(/"/g, '\\"')}"`;

    console.log(`[Codex] Executing: ${command.slice(0, 100)}...`);

    try {
      if (background) {
        return await this.executeBackground(command, projectRoot, timeout);
      } else {
        return await this.executeSync(command, projectRoot, timeout);
      }
    } catch (error) {
      console.error(`[Codex] Error: ${error.message}`);
      return {
        agent: "codex",
        error: error.message,
        stdout: error.stdout,
        stderr: error.stderr,
      };
    }
  }

  async executeSync(command, cwd, timeout) {
    return new Promise((resolve, reject) => {
      const child = spawn("bash", ["-c", command], {
        cwd,
        encoding: "utf-8",
        timeout,
        env: { ...process.env, TERM: "dumb" },
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
        process.stdout.write(`[Codex] ${data}`);
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
        process.stderr.write(`[Codex] ${data}`);
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({
            agent: "codex",
            response: stdout,
            exitCode: code,
            success: true,
          });
        } else {
          reject(new Error(`Codex exited with code ${code}`));
        }
      });

      child.on("error", reject);
    });
  }

  async executeBackground(command, cwd, timeout) {
    const child = spawn("bash", ["-c", command], {
      cwd,
      detached: true,
      stdio: "ignore",
      env: { ...process.env, TERM: "dumb" },
    });

    child.unref();

    return {
      agent: "codex",
      pid: child.pid,
      background: true,
      message: "Codex started in background",
    };
  }

  ensureGitRepo(dir) {
    const gitDir = join(dir, ".git");
    if (!existsSync(gitDir)) {
      console.log(`[Codex] Initializing git repo in ${dir}`);
      execSync("git init", { cwd: dir, encoding: "utf-8" });
      execSync("git add -A", { cwd: dir, encoding: "utf-8" });
      execSync('git commit -m "Initial commit" --allow-empty', {
        cwd: dir,
        encoding: "utf-8",
      });
    }
  }

  buildPrompt(task) {
    let prompt = task.description || task.name;

    if (task.files && task.files.length > 0) {
      prompt += `\n\nFiles to work with: ${task.files.join(", ")}`;
    }

    if (task.context) {
      prompt += `\n\nContext: ${JSON.stringify(task.context).slice(0, 500)}`;
    }

    return prompt;
  }

  getFlags() {
    switch (this.mode) {
      case "yolo":
        return "--yolo";
      case "sandbox":
        return "--sandbox danger-full-access";
      case "full-auto":
      default:
        return "--full-auto";
    }
  }

  async review(PRNumber) {
    const projectRoot = this.projectDir;
    const command = `codex review --base origin/main`;

    console.log(`[Codex] Reviewing PR...`);

    try {
      const result = await this.executeSync(command, projectRoot, 60000);
      return {
        agent: "codex",
        type: "review",
        response: result.response,
      };
    } catch (error) {
      return {
        agent: "codex",
        type: "review",
        error: error.message,
      };
    }
  }

  async fixIssue(issueNumber, description) {
    const task = {
      name: `Fix issue #${issueNumber}`,
      description: `Fix issue #${issueNumber}: ${description}. Commit when done.`,
    };

    return await this.execute(task);
  }

  getStatus() {
    try {
      const result = execSync("codex --version", { encoding: "utf-8" });
      return {
        installed: true,
        version: result.trim(),
        mode: this.mode,
        projectDir: this.projectDir,
      };
    } catch {
      return {
        installed: false,
        error: "Codex not found",
      };
    }
  }
}
