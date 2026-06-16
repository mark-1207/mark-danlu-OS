import type { ImageProvider, ImageGenerationOptions, ImageGenerationResult } from '../types.js';

export class PollinationsProvider implements ImageProvider {
  name = 'pollinations';

  async generate(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const width = options.width ?? 1024;
    const height = options.height ?? 1024;
    const seed = options.seed ?? Math.floor(Math.random() * 100000);
    const model = options.model ?? 'flux';

    const encodedPrompt = encodeURIComponent(options.prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&model=${model}`;

    return { imageUrl, seed };
  }
}
