import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import {
  Analyzer,
  AnalysisStore,
  PlanBuilder,
  ReportGenerator,
  type AnalysisResult,
  type AnalyzeOutput,
  type MigrationResult,
} from '@upgrade-assistant/core';
import { createContext, parseTargets, type CliContext } from '../context.js';
import { ui } from '../ui.js';

export const REPORT_FILE = 'MIGRATION_REPORT.md';

export interface SharedFlags {
  dir: string;
  json?: boolean;
  offline?: boolean;
  target?: string[];
  /** Keep only these rule ids (drops plans left with no findings). */
  only?: string[];
  /** Remove these rule ids from findings and plans. */
  skip?: string[];
}

export interface AnalysisRun extends AnalyzeOutput {
  ctx: CliContext;
}

/** Run the full analysis pipeline and persist cache + report. */
export async function runAnalysis(flags: SharedFlags, quiet = false): Promise<AnalysisRun> {
  const ctx = await createContext(flags.dir, flags.offline);
  for (const warning of ctx.configWarnings) ui.warn(warning);
  warnUnknownRuleIds(ctx, [...(flags.only ?? []), ...(flags.skip ?? [])]);

  const analyzer = new Analyzer(ctx.registry, ctx.npm);
  const output = await analyzer.analyze(flags.dir, {
    targets: { ...ctx.config.targets, ...parseTargets(flags.target) },
    onProgress: quiet || flags.json ? undefined : ui.progress,
  });

  output.analysis = filterAnalysis(output.analysis, flags);

  new AnalysisStore(output.project.rootDir).save(output.analysis);
  writeReport(output, undefined);
  return { ...output, ctx };
}

/**
 * Apply `--only` / `--skip` after the deterministic analysis.
 *
 * Runs post-analysis on purpose: filtering detection would silently skew
 * risk/effort numbers; filtering findings and rebuilding plans keeps the
 * estimates honest for exactly what will be executed.
 */
export function filterAnalysis(
  analysis: AnalysisResult,
  filter: { only?: string[]; skip?: string[] },
): AnalysisResult {
  const only = filter.only ?? [];
  const skip = filter.skip ?? [];
  if (only.length === 0 && skip.length === 0) return analysis;

  const planBuilder = new PlanBuilder();
  const plans = analysis.plans
    .map((plan) => {
      const findings = plan.findings.filter(
        (f) =>
          (only.length === 0 || only.includes(f.rule.id)) && !skip.includes(f.rule.id),
      );
      return planBuilder.build(plan.candidate, findings);
    })
    // With --only the user asked for focus: drop upgrades it doesn't touch.
    .filter((plan) => only.length === 0 || plan.findings.length > 0);

  return { ...analysis, plans };
}

/** Typo guard: rule ids that exist in no registered plugin. */
function warnUnknownRuleIds(ctx: CliContext, ids: string[]): void {
  if (ids.length === 0) return;
  const known = new Set(ctx.registry.all().flatMap((p) => p.rules.map((r) => r.id)));
  for (const id of ids) {
    if (!known.has(id)) {
      ui.warn(`Unknown rule id "${id}" — run \`upgrade-assistant plugins\` and check the report for valid ids.`);
    }
  }
}

/** Write MIGRATION_REPORT.md (optionally including migration results). */
export function writeReport(output: AnalyzeOutput, migration?: MigrationResult): string {
  const markdown = new ReportGenerator().toMarkdown(output.analysis, migration);
  const path = join(output.project.rootDir, REPORT_FILE);
  writeFileSync(path, markdown, 'utf8');
  return path;
}

/** Uniform error handling for every command. */
export function runCommand(fn: () => Promise<void>): void {
  fn().catch((error: unknown) => {
    ui.fail(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
