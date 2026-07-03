import type { AiProvider } from '../ai/providers/index.js';

export class FixturePatchProvider implements AiProvider {
  readonly name = 'fixture';
  readonly model = 'fixture-oracle';

  constructor(private readonly patch: string) {}

  async complete(): Promise<string> {
    return this.patch;
  }
}
