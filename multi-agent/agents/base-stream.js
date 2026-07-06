export class StreamHandler {
  constructor(response) {
    this.response = response;
    this.buffer = "";
    this.toolCalls = [];
    this.currentToolCall = null;
    this.content = "";
  }

  async processSSE(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      this.buffer += chunk;

      const lines = this.buffer.split("\n");
      this.buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            this.processChunk(parsed);
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    return {
      content: this.content,
      tool_calls: this.toolCalls,
    };
  }

  processChunk(chunk) {
    const choice = chunk.choices?.[0];
    if (!choice) return;

    const delta = choice.delta;
    if (!delta) return;

    // Content
    if (delta.content) {
      this.content += delta.content;
      if (this.response && !this.response.writableEnded) {
        this.response.write(`data: ${JSON.stringify({ type: "content", content: delta.content })}\n\n`);
      }
    }

    // Tool calls
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        if (tc.index !== undefined) {
          // New tool call
          if (!this.toolCalls[tc.index]) {
            this.toolCalls[tc.index] = {
              id: tc.id || "",
              type: "function",
              function: { name: "", arguments: "" },
            };
          }
          const current = this.toolCalls[tc.index];

          if (tc.id) current.id = tc.id;
          if (tc.function?.name) current.function.name += tc.function.name;
          if (tc.function?.arguments) current.function.arguments += tc.function.arguments;

          if (this.response && !this.response.writableEnded) {
            this.response.write(`data: ${JSON.stringify({
              type: "tool_call",
              tool: current.function.name,
              arguments: tc.function?.arguments || "",
            })}\n\n`);
          }
        }
      }
    }

    // Tool call complete
    if (choice.finish_reason === "tool_calls") {
      if (this.response && !this.response.writableEnded) {
        this.response.write(`data: ${JSON.stringify({ type: "tool_calls_complete" })}\n\n`);
      }
    }
  }

  sendEvent(event) {
    if (this.response && !this.response.writableEnded) {
      this.response.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  }

  close() {
    if (this.response && !this.response.writableEnded) {
      this.response.write("data: [DONE]\n\n");
      this.response.end();
    }
  }
}
