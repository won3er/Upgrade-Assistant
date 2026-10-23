import type { AnalysisResult } from '../domain/types.js';
import type { AiProvider } from './ai-provider.js';

/**
 * Produces the optional "Explanation" section of the report.
 *
 * Grounding strategy: the prompt contains ONLY data from the knowledge
 * base (rule titles, descriptions, official sources) and the project's own
 * findings. The model is explicitly instructed to add nothing beyond that
 * input. If it can't help, the feature degrades to absence — never to
 * invention.
 */
export class Explainer {
  constructor(private readonly ai: AiProvider) {}

  canExplain(): boolean {
    return this.ai.isAvailable();
  }

  async explain(analysis: AnalysisResult): Promise<string> {
    const facts = analysis.plans.map((plan) => ({
      package: plan.candidate.packageName,
      from: plan.candidate.currentVersion,
      to: plan.candidate.targetVersion,
      risk: plan.risk,
      estimatedMinutes: plan.estimatedMinutes,
      findings: plan.findings.map((f) => ({
        title: f.rule.title,
        severity: f.rule.severity,
        fix: f.rule.fix,
        description: f.rule.description,
        affectedFiles: [...new Set(f.matches.map((m) => m.filePath))],
        sources: f.rule.sources.map((s) => s.url),
      })),
    }));

    const prompt = [
      'You are the explanation layer of a migration tool. Below is a JSON analysis',
      'produced deterministically from official changelogs and the AST of a real project.',
      '',
      'Write a short migration briefing for the team (max ~350 words), in English:',
      '1. What is changing and why it matters for THIS project specifically.',
      '2. The order you would tackle it in and where the real risk is.',
      '3. Which parts are safe to automate versus need review.',
      '',
      'STRICT RULES: Use ONLY the facts in the JSON. Do not invent APIs, versions,',
      'file names or behaviors. Do not suggest code. Cite sources by URL when useful.',
      '',
      JSON.stringify(facts, null, 2),
    ].join('\n');

    return this.ai.complete(prompt);
  }
}
