import type { ImageProvider } from './types.js';
import { PollinationsProvider } from './implementations/pollinations.js';

export class ImageFactory {
  private provider: ImageProvider;

  constructor() {
    this.provider = new PollinationsProvider();
  }

  getProvider(): ImageProvider {
    return this.provider;
  }
}

export const imageFactory = new ImageFactory();
