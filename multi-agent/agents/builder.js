import { Agent } from "./base.js";

const BUILDER_PROMPT = `You are a senior software developer. Your job is to implement code based on task descriptions.

When given a task:
1. Read existing code to understand context
2. Write clean, production-ready code
3. Follow best practices and conventions
4. Create necessary files and structure
5. Run tests if applicable

Rules:
- Write complete, working code
- Handle errors gracefully
- Follow the project's existing style
- Create tests when appropriate
- Report what you created/modified

Output format:
After completing the task, provide a summary:
- Files created/modified
- Key decisions made
- Any issues encountered
- Next steps if needed`;

export class BuilderAgent extends Agent {
  constructor(config = {}) {
    super("builder", {
      systemPrompt: BUILDER_PROMPT,
      allowedTools: ["read_file", "write_file", "list_files", "bash", "search"],
      ...config,
    });
  }

  async implement(task, context = {}) {
    const prompt = `Task: ${task.name}\n\nDescription: ${task.description}\n\n${task.details || ""}`;

    return await this.run({ prompt, context }, context);
  }
}
