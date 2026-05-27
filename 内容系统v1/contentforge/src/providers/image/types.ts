export interface ImageGenerationOptions {
  prompt: string;
  width?: number;
  height?: number;
  seed?: number;
  model?: string;
}

export interface ImageGenerationResult {
  imageUrl: string;
  seed?: number;
}

export interface ImageProvider {
  name: string;
  generate(options: ImageGenerationOptions): Promise<ImageGenerationResult>;
}
