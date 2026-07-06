import { execSync, exec } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

export class VideoEditor {
  constructor(config = {}) {
    this.outputDir = config.outputDir || "./media/output";
    this.tempDir = config.tempDir || "./media/temp";

    // Ensure directories exist
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async concatVideos(inputs, outputName, options = {}) {
    console.log(`[VideoEditor] Concatenating ${inputs.length} videos`);

    const outputPath = join(this.outputDir, outputName || `concat_${Date.now()}.mp4`);

    // Create concat list file
    const listContent = inputs.map((input) => `file '${input}'`).join("\n");
    const listPath = join(this.tempDir, `concat_${Date.now()}.txt`);

    try {
      // Write concat list
      const { writeFileSync } = await import("fs");
      writeFileSync(listPath, listContent);

      // Run FFmpeg
      const command = `ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy "${outputPath}"`;
      execSync(command, { stdio: "pipe" });

      console.log(`[VideoEditor] Videos concatenated: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error(`[VideoEditor] Concat failed: ${error.message}`);
      throw error;
    }
  }

  async addAudio(videoPath, audioPath, outputName, options = {}) {
    console.log(`[VideoEditor] Adding audio to video`);

    const outputPath = join(this.outputDir, outputName || `audio_${Date.now()}.mp4`);

    try {
      const command = `ffmpeg -y -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -shortest "${outputPath}"`;
      execSync(command, { stdio: "pipe" });

      console.log(`[VideoEditor] Audio added: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error(`[VideoEditor] Add audio failed: ${error.message}`);
      throw error;
    }
  }

  async trimVideo(inputPath, startTime, duration, outputName, options = {}) {
    console.log(`[VideoEditor] Trimming video from ${startTime}s for ${duration}s`);

    const outputPath = join(this.outputDir, outputName || `trimmed_${Date.now()}.mp4`);

    try {
      const command = `ffmpeg -y -ss ${startTime} -i "${inputPath}" -t ${duration} -c copy "${outputPath}"`;
      execSync(command, { stdio: "pipe" });

      console.log(`[VideoEditor] Video trimmed: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error(`[VideoEditor] Trim failed: ${error.message}`);
      throw error;
    }
  }

  async addTextOverlay(inputPath, text, outputName, options = {}) {
    console.log(`[VideoEditor] Adding text overlay: "${text}"`);

    const outputPath = join(this.outputDir, outputName || `text_${Date.now()}.mp4`);
    const fontSize = options.fontSize || 48;
    const position = options.position || "center";

    let x, y;
    switch (position) {
      case "top":
        x = "(w-text_w)/2";
        y = "50";
        break;
      case "bottom":
        x = "(w-text_w)/2";
        y = "h-text_h-50";
        break;
      default:
        x = "(w-text_w)/2";
        y = "(h-text_h)/2";
    }

    try {
      const command = `ffmpeg -y -i "${inputPath}" -vf "drawtext=text='${text}':fontsize=${fontSize}:fontcolor=white:x=${x}:y=${y}" -codec:a copy "${outputPath}"`;
      execSync(command, { stdio: "pipe" });

      console.log(`[VideoEditor] Text overlay added: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error(`[VideoEditor] Text overlay failed: ${error.message}`);
      throw error;
    }
  }

  async getVideoInfo(videoPath) {
    try {
      const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`;
      const output = execSync(command, { encoding: "utf-8" });
      return JSON.parse(output);
    } catch (error) {
      console.error(`[VideoEditor] Get info failed: ${error.message}`);
      throw error;
    }
  }

  getStatus() {
    let ffmpegInstalled = false;
    try {
      execSync("ffmpeg -version", { stdio: "pipe" });
      ffmpegInstalled = true;
    } catch {}

    return {
      ffmpegInstalled,
      outputDir: this.outputDir,
      tempDir: this.tempDir,
    };
  }
}

export function createVideoEditor(config = {}) {
  return new VideoEditor(config);
}
