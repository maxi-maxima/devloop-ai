import { describe, expect, test } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  test('loads defaults for an OpenAI-compatible provider', () => {
    const config = loadConfig({ OPENAI_API_KEY: 'test-key' });

    expect(config.openai.apiKey).toBe('test-key');
    expect(config.openai.baseUrl).toBe('https://api.openai.com/v1');
    expect(config.openai.model).toBe('gpt-4.1-mini');
  });

  test('accepts custom compatible endpoint and GitHub token', () => {
    const config = loadConfig({
      OPENAI_API_KEY: 'test-key',
      OPENAI_BASE_URL: 'https://llm.example.com/v1',
      OPENAI_MODEL: 'compatible-model',
      GITHUB_TOKEN: 'ghp_test'
    });

    expect(config.openai.baseUrl).toBe('https://llm.example.com/v1');
    expect(config.openai.model).toBe('compatible-model');
    expect(config.github.token).toBe('ghp_test');
  });
});
