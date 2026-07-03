import type { AiProvider } from './index.js';

export interface AnthropicProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  readonly model: string;

  constructor(private readonly options: AnthropicProviderOptions) {
    this.model = options.model;
  }

  async complete(): Promise<string> {
    throw new Error(
      `Anthropic provider placeholder is configured for ${this.options.model}, but V1 only implements OpenAI and Ollama calls.`
    );
  }
}
