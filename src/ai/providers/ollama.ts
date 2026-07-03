import type { AiProvider } from './index.js';

export interface OllamaProviderOptions {
  baseUrl: string;
  model: string;
}

export class OllamaProvider implements AiProvider {
  readonly name = 'ollama';
  readonly model: string;

  constructor(
    private readonly options: OllamaProviderOptions,
    private readonly fetchImpl: typeof fetch = fetch
  ) {
    this.model = options.model;
  }

  async complete(prompt: string): Promise<string> {
    const response = await this.fetchImpl(`${this.options.baseUrl.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.options.model,
        prompt,
        stream: false
      })
    });
    const payload = (await response.json()) as { response?: string; error?: string };

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${payload.error ?? response.statusText}`);
    }

    if (!payload.response) {
      throw new Error('Ollama response did not include generated text.');
    }

    return payload.response;
  }
}
