import { join } from 'node:path';
import { Explainer } from '@upgrade-assistant/core';
import { printAnalysis, ui } from '../ui.js';
import { runAnalysis, REPORT_FILE, type SharedFlags } from './shared.js';

export interface AnalyzeFlags extends SharedFlags {
  explain?: boolean;
}

/**
 * `upgrade-assistant analyze` — the core loop:
 * what can be upgraded, what breaks in THIS project, where, and how long
 * it will realistically take.
 */
export async function analyzeCommand(flags: AnalyzeFlags): Promise<void> {
  const run = await runAnalysis(flags);

  if (flags.json) {
    console.log(JSON.stringify(run.analysis, null, 2));
    return;
  }

  printAnalysis(run.analysis);
  ui.line();
  ui.info(`Full report: ${join(run.project.rootDir, REPORT_FILE)}`);
  if (run.analysis.plans.length > 0) {
    ui.dim('Next: `upgrade-assistant plan` to see the ordered steps, or `upgrade-assistant migrate` to apply.');
  }

  if (flags.explain) {
    const explainer = new Explainer(run.ctx.ai);
    if (!explainer.canExplain()) {
      ui.warn('--explain requires an AI provider. Set ANTHROPIC_API_KEY and try again.');
      return;
    }
    ui.title('Explanation (AI, grounded on the analysis above)');
    try {
      ui.line(await explainer.explain(run.analysis));
    } catch (error) {
      ui.warn(`Explanation unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
