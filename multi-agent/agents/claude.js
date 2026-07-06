import { execSync, spawn } from "child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { getProjectRoot } from "../tools/registry.js";

const CLAUDE_PROMPT = `You are an expert software developer using Claude Code.
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

export class ClaudeCodeAgent {
  constructor(config = {}) {
    this.name = "claude";
    this.projectDir = config.projectDir || getProjectRoot();
    this.mode = config.mode || "full-auto"; // full-auto, plan, code
    this.model = config.model || null; // null = default model
    this.maxRetries = config.maxRetries || 2;
    this.persistent = config.persistent || null;
  }

  async execute(task, options = {}) {
    const { background = false, timeout = 300000 } = options;
    const projectRoot = this.projectDir;

    this.ensureGitRepo(projectRoot);

    const prompt = this.buildPrompt(task);
    const args = this.getArgs();
    const command = `claude ${args} --print "${prompt.replace(/"/g, '\\"')}"`;

    console.log(`[Claude Code] Executing: claude ${args} --print "...`);

    try {
      if (background) {
        return await this.executeBackground(command, projectRoot, timeout);
      } else {
        return await this.executeSync(command, projectRoot, timeout);
      }
    } catch (error) {
      console.error(`[Claude Code] Error: ${error.message}`);
      return {
        agent: "claude",
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
        process.stdout.write(`[Claude] ${data}`);
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
        process.stderr.write(`[Claude] ${data}`);
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({
            agent: "claude",
            response: stdout,
            exitCode: code,
            success: true,
          });
        } else {
          reject(new Error(`Claude exited with code ${code}`));
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
      agent: "claude",
      pid: child.pid,
      background: true,
      message: "Claude started in background",
    };
  }

  ensureGitRepo(dir) {
    const gitDir = join(dir, ".git");
    if (!existsSync(gitDir)) {
      console.log(`[Claude] Initializing git repo in ${dir}`);
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
    const modelFlag = this.model ? `--model ${this.model}` : "";
    const toolsFlag = '--allowedTools "Edit,Write,Bash,Read,Glob,Grep"';
    return `${modelFlag} ${toolsFlag}`.trim();
  }

  async review() {
    const projectRoot = this.projectDir;
    const prompt = "Review the current codebase for issues, improvements, and best practices. Provide a structured report.";
    const args = this.getArgs();
    const command = `claude ${args} --print "${prompt.replace(/"/g, '\\"')}"`;

    console.log(`[Claude] Reviewing codebase...`);

    try {
      const result = await this.executeSync(command, projectRoot, 120000);
      return {
        agent: "claude",
        type: "review",
        response: result.response,
      };
    } catch (error) {
      return {
        agent: "claude",
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
      const result = execSync("claude --version", { encoding: "utf-8" });
      return {
        installed: true,
        version: result.trim(),
        model: this.model,
        mode: this.mode,
        projectDir: this.projectDir,
      };
    } catch {
      return {
        installed: false,
        error: "Claude Code not found. Install: npm install -g @anthropic-ai/claude-code",
      };
    }
  }
}
