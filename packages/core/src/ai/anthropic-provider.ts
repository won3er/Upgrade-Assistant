import type { AiProvider } from './ai-provider.js';

/**
 * Anthropic provider over plain fetch — no SDK dependency for one endpoint.
 * Enabled by ANTHROPIC_API_KEY; model overridable via UA_AI_MODEL.
 */
export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';

  constructor(
    private readonly apiKey = process.env['ANTHROPIC_API_KEY'],
    private readonly model = process.env['UA_AI_MODEL'] ?? 'claude-sonnet-4-5',
  ) {}

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(prompt: string, options: { maxTokens?: number } = {}): Promise<string> {
    if (!this.apiKey) throw new Error('ANTHROPIC_API_KEY is not set.');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options.maxTokens ?? 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);
    }
    const data = (await response.json()) as { content?: { type: string; text?: string }[] };
    return (data.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');
  }
}
