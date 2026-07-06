export class MediaAnalyzer {
  constructor(config = {}) {
    this.replicate = config.replicate || null;
  }

  async analyzeImage(imageUrl, options = {}) {
    console.log(`[Analyzer] Analyzing image: ${imageUrl}`);

    // Use a vision model for analysis
    const model = options.model || "yorickvp/llava-13b";
    const input = {
      image: imageUrl,
      prompt: options.prompt || "Describe this image in detail. What objects, colors, and actions do you see?",
    };

    try {
      const prediction = await this.replicate.provider.run(model, input);
      const result = await this.replicate.provider.poll(prediction.id);

      return {
        imageUrl,
        analysis: result.output,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(`[Analyzer] Analysis failed: ${error.message}`);
      throw error;
    }
  }

  async detectObjects(imageUrl, options = {}) {
    console.log(`[Analyzer] Detecting objects in image: ${imageUrl}`);

    const model = options.model || "facebookresearch/detr-resnet-50";
    const input = {
      image: imageUrl,
    };

    try {
      const prediction = await this.replicate.provider.run(model, input);
      const result = await this.replicate.provider.poll(prediction.id);

      return {
        imageUrl,
        objects: result.output,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(`[Analyzer] Object detection failed: ${error.message}`);
      throw error;
    }
  }

  async generateCaption(imageUrl, options = {}) {
    console.log(`[Analyzer] Generating caption for image: ${imageUrl}`);

    const model = options.model || "salesforce/blip";
    const input = {
      image: imageUrl,
    };

    try {
      const prediction = await this.replicate.provider.run(model, input);
      const result = await this.replicate.provider.poll(prediction.id);

      return {
        imageUrl,
        caption: result.output,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(`[Analyzer] Caption generation failed: ${error.message}`);
      throw error;
    }
  }
}

export function createMediaAnalyzer(config = {}) {
  return new MediaAnalyzer(config);
}
