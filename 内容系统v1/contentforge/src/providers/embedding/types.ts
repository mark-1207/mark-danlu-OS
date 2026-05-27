export interface EmbeddingOptions {
  text: string;
  model?: string;
}

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

export interface EmbeddingProvider {
  name: string;
  embed(options: EmbeddingOptions): Promise<EmbeddingResult>;
}
