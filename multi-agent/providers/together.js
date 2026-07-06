const TOGETHER_API_URL = "https://api.together.xyz/v1";

export class TogetherProvider {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.TOGETHER_API_KEY;
    this.model = config.model || "meta-llama/Llama-3-70b-chat-hf";
    this.baseUrl = config.baseUrl || TOGETHER_API_URL;
  }

  async chat(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error("TOGETHER_API_KEY not set");
    }

    const payload = {
      model: options.model || this.model,
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4096,
      stream: false,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Together API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  async chatStream(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error("TOGETHER_API_KEY not set");
    }

    const payload = {
      model: options.model || this.model,
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4096,
      stream: true,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Together API error: ${response.status} - ${error}`);
    }

    return response.body;
  }

  async complete(prompt, options = {}) {
    const messages = [{ role: "user", content: prompt }];
    const result = await this.chat(messages, options);
    return result.choices?.[0]?.message?.content || "";
  }

  isAvailable() {
    return !!this.apiKey;
  }

  getModels() {
    return [
      "meta-llama/Llama-3-70b-chat-hf",
      "meta-llama/Llama-3-8b-chat-hf",
      "codellama/CodeLlama-34b-Instruct-HF",
      "mistralai/Mixtral-8x7B-Instruct-v0.1",
      "google/gemma-2-27b-it",
    ];
  }
}

export function createTogetherProvider(config = {}) {
  const provider = new TogetherProvider(config);

  return {
    name: "together",
    provider,

    async chat(prompt, options = {}) {
      const messages = [{ role: "user", content: prompt }];
      const result = await provider.chat(messages, options);
      return result.choices?.[0]?.message?.content || "";
    },
  };
}
