import { Agent } from "./base.js";
import { execSync, spawn } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getProjectRoot } from "../tools/registry.js";

const MIMO_PROMPT = `You are an expert software developer using MiMo Code (powered by Claude Code with GLM 4.7).
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

export class MiMoAgent extends Agent {
  constructor(config = {}) {
    super("mimo", {
      systemPrompt: MIMO_PROMPT,
      allowedTools: ["read_file", "write_file", "list_files", "bash", "search"],
      ...config,
    });
    this.projectDir = config.projectDir || getProjectRoot();
  }

  async implement(task, context = {}) {
    const prompt = this.buildPrompt(task);
    const args = this.getArgs();
    const command = `claude ${args} --print "${prompt.replace(/"/g, '\\"')}"`;

    console.log(`[MiMo] Executing: claude ${args} --print "...`);

    try {
      const result = await this.executeSync(command, this.projectDir, 300000);
      return {
        agent: this.name,
        response: result.response,
        exitCode: result.exitCode,
        success: result.success,
        iterations: 1,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(`[MiMo] Error: ${error.message}`);
      return {
        agent: this.name,
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
        process.stdout.write(`[MiMo] ${data}`);
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
        process.stderr.write(`[MiMo] ${data}`);
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({
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
    const toolsFlag = '--allowedTools "Edit,Write,Bash,Read,Glob,Grep"';
    return toolsFlag;
  }
}
