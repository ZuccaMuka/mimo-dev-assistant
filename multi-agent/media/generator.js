import { createReplicateProvider } from "../providers/replicate.js";

export class MediaGenerator {
  constructor(config = {}) {
    this.replicate = createReplicateProvider(config);
    this.outputDir = config.outputDir || "./media/output";
  }

  async generateImage(prompt, options = {}) {
    console.log(`[Media] Generating image: "${prompt.slice(0, 50)}..."`);

    try {
      const result = await this.replicate.generateImage(prompt, options);
      console.log(`[Media] Image generated successfully`);

      return {
        type: "image",
        prompt,
        urls: result.images,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(`[Media] Image generation failed: ${error.message}`);
      throw error;
    }
  }

  async generateVideo(prompt, options = {}) {
    console.log(`[Media] Generating video: "${prompt.slice(0, 50)}..."`);

    try {
      const result = await this.replicate.generateVideo(prompt, options);
      console.log(`[Media] Video generated successfully`);

      return {
        type: "video",
        prompt,
        urls: result.video,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(`[Media] Video generation failed: ${error.message}`);
      throw error;
    }
  }

  async editImage(imageUrl, prompt, options = {}) {
    console.log(`[Media] Editing image: "${prompt.slice(0, 50)}..."`);

    const model = options.model || "black-forest-labs/flux-1.1-pro";
    const input = {
      prompt,
      image_urls: [imageUrl],
      ...options.extra,
    };

    try {
      const prediction = await this.replicate.provider.run(model, input);
      const result = await this.replicate.provider.poll(prediction.id);

      return {
        type: "image",
        prompt,
        originalImage: imageUrl,
        urls: result.output,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(`[Media] Image editing failed: ${error.message}`);
      throw error;
    }
  }

  getStatus() {
    return {
      replicate: this.replicate.provider.isAvailable(),
      outputDir: this.outputDir,
    };
  }
}

export function createMediaGenerator(config = {}) {
  return new MediaGenerator(config);
}
