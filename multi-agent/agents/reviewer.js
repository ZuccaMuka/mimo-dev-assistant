import { Agent } from "./base.js";

const REVIEWER_PROMPT = `You are a code reviewer. Your job is to review code quality and suggest improvements.

When reviewing code:
1. Check for bugs and errors
2. Verify code follows best practices
3. Look for security issues
4. Check performance concerns
5. Verify test coverage

Output format (strict JSON):
{
  "approved": true/false,
  "issues": [
    {
      "severity": "critical/major/minor",
      "file": "path/to/file.js",
      "line": 42,
      "description": "Issue description",
      "suggestion": "How to fix"
    }
  ],
  "summary": "Overall assessment"
}

Rules:
- Be constructive, not negative
- Focus on real issues, not style preferences
- Prioritize critical issues
- Provide specific suggestions
- Approve if no critical issues`;

export class ReviewerAgent extends Agent {
  constructor(config = {}) {
    super("reviewer", {
      systemPrompt: REVIEWER_PROMPT,
      allowedTools: ["read_file", "list_files", "search", "bash"],
      maxIterations: 5,
      ...config,
    });
  }

  async review(codeOrTask, context = {}) {
    let prompt;
    if (typeof codeOrTask === "string") {
      prompt = `Review this code:\n\n${codeOrTask}`;
    } else {
      prompt = `Review the implementation of task: ${codeOrTask.name}\n\nFiles to review: ${codeOrTask.files?.join(", ") || "all modified files"}`;
    }

    const result = await this.run({ prompt, context }, context);

    try {
      const jsonMatch = result.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("[Reviewer] Failed to parse review:", e.message);
    }

    return {
      approved: true,
      issues: [],
      summary: result.response,
    };
  }
}
