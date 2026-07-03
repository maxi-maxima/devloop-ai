export interface LlmClientOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export class LlmClient {
  constructor(
    private readonly options: LlmClientOptions,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async complete(prompt: string): Promise<string> {
    const response = await this.fetchImpl(`${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.options.model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You are DevLoop AI, an autonomous software engineering agent. Return only the requested structured output.'
          },
          { role: 'user', content: prompt }
        ]
      })
    });

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(`LLM request failed: ${payload.error?.message ?? response.statusText}`);
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('LLM response did not include message content.');
    }

    return content;
  }
}
