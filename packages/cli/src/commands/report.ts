import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AnalysisStore, ReportGenerator } from '@upgrade-assistant/core';
import { ui } from '../ui.js';
import { runAnalysis, REPORT_FILE, type SharedFlags } from './shared.js';

export interface ReportFlags extends SharedFlags {
  print?: boolean;
}

/**
 * `upgrade-assistant report` — regenerate MIGRATION_REPORT.md from the last
 * analysis (or run a fresh one when no cache exists).
 */
export async function reportCommand(flags: ReportFlags): Promise<void> {
  const cached = new AnalysisStore(flags.dir).load();

  if (cached) {
    const markdown = new ReportGenerator().toMarkdown(cached);
    const path = join(cached.rootDir, REPORT_FILE);
    const { writeFileSync } = await import('node:fs');
    writeFileSync(path, markdown, 'utf8');
    ui.success(`Report regenerated from cached analysis (${cached.createdAt.slice(0, 19)})`);
    ui.info(path);
    if (flags.print) ui.line(`\n${markdown}`);
    ui.dim('Cache stale? Run `upgrade-assistant analyze` for a fresh one.');
    return;
  }

  ui.dim('No cached analysis — running a fresh one.');
  const run = await runAnalysis(flags);
  const path = join(run.project.rootDir, REPORT_FILE);
  ui.success('Report generated');
  ui.info(path);
  if (flags.print) ui.line(`\n${readFileSync(path, 'utf8')}`);
}
