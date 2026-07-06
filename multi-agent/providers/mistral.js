const MISTRAL_API_URL = "https://api.mistral.ai/v1";

export class MistralProvider {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.MISTRAL_API_KEY;
    this.model = config.model || "mistral-large-latest";
    this.baseUrl = config.baseUrl || MISTRAL_API_URL;
  }

  async chat(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error("MISTRAL_API_KEY not set");
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
      throw new Error(`Mistral API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  async chatStream(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error("MISTRAL_API_KEY not set");
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
      throw new Error(`Mistral API error: ${response.status} - ${error}`);
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
      "mistral-large-latest",
      "mistral-medium-latest",
      "mistral-small-latest",
      "open-mixtral-8x22b",
      "open-mixtral-8x7b",
      "mistral-tiny",
    ];
  }
}

export function createMistralProvider(config = {}) {
  const provider = new MistralProvider(config);

  return {
    name: "mistral",
    provider,

    async chat(prompt, options = {}) {
      const messages = [{ role: "user", content: prompt }];
      const result = await provider.chat(messages, options);
      return result.choices?.[0]?.message?.content || "";
    },
  };
}
