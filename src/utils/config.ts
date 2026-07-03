export interface RuntimeConfig {
  openai: {
    apiKey?: string;
    baseUrl: string;
    model: string;
  };
  github: {
    token?: string;
  };
}

export interface RequiredOpenAiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  return {
    openai: {
      apiKey: env.OPENAI_API_KEY,
      baseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
      model: env.OPENAI_MODEL ?? 'gpt-4.1-mini'
    },
    github: {
      token: env.GITHUB_TOKEN
    }
  };
}

export function requireOpenAiConfig(config: RuntimeConfig): RequiredOpenAiConfig {
  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY is required. Add it to .env or your shell environment.');
  }

  return {
    apiKey: config.openai.apiKey,
    baseUrl: config.openai.baseUrl,
    model: config.openai.model
  };
}

export function requireGitHubConfig(config: RuntimeConfig): RuntimeConfig['github'] & { token: string } {
  if (!config.github.token) {
    throw new Error('GITHUB_TOKEN is required to create pull requests.');
  }

  return { token: config.github.token };
}
