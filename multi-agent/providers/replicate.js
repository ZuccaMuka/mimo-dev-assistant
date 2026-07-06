const REPLICATE_API_URL = "https://api.replicate.com/v1";

export class ReplicateProvider {
  constructor(config = {}) {
    this.apiToken = config.apiToken || process.env.REPLICATE_API_TOKEN;
    this.baseUrl = config.baseUrl || REPLICATE_API_URL;
  }

  async run(model, input = {}) {
    if (!this.apiToken) {
      throw new Error("REPLICATE_API_TOKEN not set");
    }

    const response = await fetch(`${this.baseUrl}/models/${model}/predictions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${this.apiToken}`,
      },
      body: JSON.stringify({ input }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Replicate API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  async poll(predictionId, maxAttempts = 30) {
    if (!this.apiToken) {
      throw new Error("REPLICATE_API_TOKEN not set");
    }

    let attempts = 0;
    while (attempts < maxAttempts) {
      const response = await fetch(`${this.baseUrl}/predictions/${predictionId}`, {
        headers: {
          Authorization: `Token ${this.apiToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Replicate API error: ${response.status} - ${error}`);
      }

      const prediction = await response.json();

      if (prediction.status === "succeeded") {
        return prediction;
      }

      if (prediction.status === "failed" || prediction.status === "canceled") {
        throw new Error(`Prediction ${prediction.status}: ${prediction.error}`);
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error("Prediction timed out");
  }

  async generateImage(prompt, options = {}) {
    const model = options.model || "black-forest-labs/flux-schnell";
    const input = {
      prompt,
      width: options.width || 1024,
      height: options.height || 1024,
      num_outputs: options.numOutputs || 1,
      ...options.extra,
    };

    const prediction = await this.run(model, input);
    const result = await this.poll(prediction.id);

    return {
      images: result.output,
      prediction: result,
    };
  }

  async generateVideo(prompt, options = {}) {
    const model = options.model || "stability-ai/stable-video-diffusion";
    const input = {
      input_image: options.image || prompt,
      ...options.extra,
    };

    const prediction = await this.run(model, input);
    const result = await this.poll(prediction.id);

    return {
      video: result.output,
      prediction: result,
    };
  }

  isAvailable() {
    return !!this.apiToken;
  }
}

export function createReplicateProvider(config = {}) {
  const provider = new ReplicateProvider(config);

  return {
    name: "replicate",
    provider,

    async generateImage(prompt, options = {}) {
      return provider.generateImage(prompt, options);
    },

    async generateVideo(prompt, options = {}) {
      return provider.generateVideo(prompt, options);
    },
  };
}
