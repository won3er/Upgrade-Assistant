/**
 * AI boundary.
 *
 * Policy (see ARCHITECTURE.md): AI NEVER decides what changed between
 * versions and NEVER edits code. Those are deterministic (knowledge base +
 * AST). AI is allowed exactly where determinism can't reach: turning a
 * structured analysis into a prose explanation a team can read.
 */
export interface AiProvider {
  readonly name: string;
  isAvailable(): boolean;
  /** Single-shot completion. Implementations must not stream. */
  complete(prompt: string, options?: { maxTokens?: number }): Promise<string>;
}

/** Default provider: AI features are simply absent. Everything still works. */
export class NullAiProvider implements AiProvider {
  readonly name = 'none';
  isAvailable(): boolean {
    return false;
  }
  async complete(): Promise<string> {
    throw new Error('No AI provider configured. Set ANTHROPIC_API_KEY to enable --explain.');
  }
}
