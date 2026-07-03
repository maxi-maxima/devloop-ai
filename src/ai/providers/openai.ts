import { LlmClient, LlmClientOptions } from '../client.js';
import type { AiProvider } from './index.js';

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  readonly model: string;
  private readonly client: LlmClient;

  constructor(options: LlmClientOptions) {
    this.model = options.model;
    this.client = new LlmClient(options);
  }

  complete(prompt: string): Promise<string> {
    return this.client.complete(prompt);
  }
}
