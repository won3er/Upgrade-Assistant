import { printPlanSteps, ui } from '../ui.js';
import { runAnalysis, type SharedFlags } from './shared.js';

/**
 * `upgrade-assistant plan` — the ordered steps for each available upgrade,
 * with per-step effort estimates.
 */
export async function planCommand(flags: SharedFlags): Promise<void> {
  const run = await runAnalysis(flags);

  if (flags.json) {
    console.log(JSON.stringify(run.analysis.plans, null, 2));
    return;
  }

  if (run.analysis.plans.length === 0) {
    ui.success('Nothing to plan — everything supported is up to date.');
    return;
  }

  printPlanSteps(run.analysis);
  ui.line();
  ui.dim('Apply with `upgrade-assistant migrate` (add --dry-run to preview diffs first).');
}
