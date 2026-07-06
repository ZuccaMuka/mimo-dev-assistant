import { execSync, spawn } from "child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { getProjectRoot } from "../tools/registry.js";

const HERMES_PROMPT = `You are an expert software developer using Hermes Agent.
When given a task:
1. Analyze the request carefully
2. Write clean, production-ready code
3. Follow best practices and conventions
4. Create necessary files and structure
5. Test your work when possible

Output format:
After completing the task, provide a summary:
- Files created/modified
- Key decisions made
- Any issues encountered`;

export class HermesAgent {
  constructor(config = {}) {
    this.name = "hermes";
    this.projectDir = config.projectDir || getProjectRoot();
    this.model = config.model || null;
    this.provider = config.provider || "groq";
    this.maxRetries = config.maxRetries || 2;
    this.persistent = config.persistent || null;
    this.hermesPath = config.hermesPath || this.findHermesPath();
  }

  findHermesPath() {
    const paths = [
      "/home/hermes/.local/bin/hermes",
      "/home/hermes/.hermes/hermes-agent/venv/bin/hermes",
      "/home/hermes/.hermes/hermes-agent/hermes",
    ];

    for (const path of paths) {
      if (existsSync(path)) {
        return path;
      }
    }

    // Try to find in PATH
    try {
      return execSync("which hermes", { encoding: "utf-8" }).trim();
    } catch {
      return "hermes";
    }
  }

  async execute(task, options = {}) {
    const { background = false, timeout = 300000 } = options;
    const projectRoot = this.projectDir;

    this.ensureGitRepo(projectRoot);

    const prompt = this.buildPrompt(task);
    const args = this.getArgs();
    const command = `${this.hermesPath} ${args} -z "${prompt.replace(/"/g, '\\"')}"`;

    console.log(`[Hermes] Executing: ${this.hermesPath} ${args} -z "...`);

    try {
      if (background) {
        return await this.executeBackground(command, projectRoot, timeout);
      } else {
        return await this.executeSync(command, projectRoot, timeout);
      }
    } catch (error) {
      console.error(`[Hermes] Error: ${error.message}`);
      return {
        agent: "hermes",
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
        process.stdout.write(`[Hermes] ${data}`);
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
        process.stderr.write(`[Hermes] ${data}`);
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({
            agent: "hermes",
            response: stdout,
            exitCode: code,
            success: true,
          });
        } else {
          reject(new Error(`Hermes exited with code ${code}`));
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
      agent: "hermes",
      pid: child.pid,
      background: true,
      message: "Hermes started in background",
    };
  }

  ensureGitRepo(dir) {
    const gitDir = join(dir, ".git");
    if (!existsSync(gitDir)) {
      console.log(`[Hermes] Initializing git repo in ${dir}`);
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

  getArgs() {
    // Hermes requires both --provider and --model, or neither
    if (this.model && this.provider) {
      return `-m ${this.model} --provider ${this.provider}`;
    }
    // If neither is set, use defaults from hermes config
    return "";
  }

  async review() {
    const projectRoot = this.projectDir;
    const prompt = "Review the current codebase for issues, improvements, and best practices. Provide a structured report.";
    const args = this.getArgs();
    const command = `${this.hermesPath} ${args} -z "${prompt.replace(/"/g, '\\"')}"`;

    console.log(`[Hermes] Reviewing codebase...`);

    try {
      const result = await this.executeSync(command, projectRoot, 120000);
      return {
        agent: "hermes",
        type: "review",
        response: result.response,
      };
    } catch (error) {
      return {
        agent: "hermes",
        type: "review",
        error: error.message,
      };
    }
  }

  async fixIssue(issueNumber, description) {
    const task = {
      name: `Fix issue #${issueNumber}`,
      description: `Fix issue #${issueNumber}: ${description}. Create a commit when done.`,
    };

    return await this.execute(task);
  }

  getStatus() {
    try {
      const result = execSync(`${this.hermesPath} --version`, { encoding: "utf-8" });
      return {
        installed: true,
        version: result.trim(),
        model: this.model,
        provider: this.provider,
        projectDir: this.projectDir,
        hermesPath: this.hermesPath,
      };
    } catch {
      return {
        installed: false,
        error: "Hermes not found. Install: pip install hermes-agent",
        hermesPath: this.hermesPath,
      };
    }
  }
}
