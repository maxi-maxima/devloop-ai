import { loadConfig } from '../../utils/config.js';
import { ProviderConfig } from '../../core/types.js';
import { OpenAiProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { OllamaProvider } from './ollama.js';

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  complete(prompt: string): Promise<string>;
}

export function createAiProvider(config: ProviderConfig): AiProvider {
  if (config.provider === 'openai') {
    if (!config.apiKey) {
      throw new Error('OPENAI_API_KEY is required for OpenAI patch generation.');
    }

    return new OpenAiProvider({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? 'https://api.openai.com/v1',
      model: config.model ?? 'gpt-4.1-mini'
    });
  }

  if (config.provider === 'ollama') {
    return new OllamaProvider({
      baseUrl: config.baseUrl ?? 'http://127.0.0.1:11434',
      model: config.model ?? 'llama3.1'
    });
  }

  return new AnthropicProvider({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model ?? 'claude-3-5-sonnet-latest'
  });
}

export function providerConfigFromEnv(
  provider: ProviderConfig['provider'] = 'openai',
  model?: string
): ProviderConfig {
  const config = loadConfig();
  const baseUrl =
    provider === 'ollama'
      ? process.env.OLLAMA_BASE_URL
      : provider === 'anthropic'
        ? process.env.ANTHROPIC_BASE_URL
        : config.openai.baseUrl;
  const apiKey = provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : config.openai.apiKey;

  return {
    provider,
    apiKey,
    baseUrl,
    model: model ?? (provider === 'openai' ? config.openai.model : undefined)
  };
}
