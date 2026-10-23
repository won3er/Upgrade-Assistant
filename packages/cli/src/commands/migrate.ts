import readline from 'node:readline/promises';
import {
  GitService,
  MigrationEngine,
  Verifier,
} from '@upgrade-assistant/core';
import { printDiff, printMigrationResult, printPlanSteps, ui } from '../ui.js';
import { runAnalysis, writeReport, type SharedFlags } from './shared.js';

export interface MigrateFlags extends SharedFlags {
  dryRun?: boolean;
  yes?: boolean;
  force?: boolean;
  branch?: boolean; // commander --no-branch → false
  verify?: boolean; // commander --no-verify → false
}

/**
 * `upgrade-assistant migrate` — applies the automatable part of the plan.
 *
 * Safety rails, in order:
 *   1. always re-analyze (never trust a cache for writes)
 *   2. refuse a dirty git tree (unless --force)
 *   3. work on a dedicated branch (unless --no-branch)
 *   4. confirm before writing (unless --yes)
 *   5. verify with the project's own typechecker after writing
 */
export async function migrateCommand(flags: MigrateFlags): Promise<void> {
  // Safety gate BEFORE any analysis output is written to the project.
  const git = new GitService(flags.dir);
  const inRepo = git.isAvailable() && git.isRepository();
  if (!flags.dryRun && inRepo && !git.isClean() && !flags.force) {
    ui.fail(
      'Working tree has uncommitted changes. Commit or stash first (or pass --force). ' +
        'A clean tree is your rollback plan.',
    );
    process.exitCode = 1;
    return;
  }

  const run = await runAnalysis(flags);
  const { analysis, project, ast } = run;

  if (analysis.plans.length === 0) {
    ui.success('Nothing to migrate — everything supported is up to date.');
    return;
  }

  printPlanSteps(analysis);

  if (!flags.dryRun && !flags.yes) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question('\nApply automatic fixes and dependency updates? [y/N] ')).trim();
    rl.close();
    if (!/^y(es)?$/i.test(answer)) {
      ui.info('Aborted. Use `upgrade-assistant migrate --dry-run` to preview changes.');
      return;
    }
  }

  if (!flags.dryRun && inRepo && flags.branch !== false) {
    const branchName = `upgrade-assistant/${new Date().toISOString().slice(0, 10)}`;
    if (git.createAndCheckoutBranch(branchName)) {
      ui.info(`Created branch ${branchName}`);
    } else {
      ui.warn(`Could not create branch ${branchName} — continuing on ${git.currentBranch() ?? 'current branch'}.`);
    }
  }

  const engine = new MigrationEngine(project, ast, run.ctx.registry.asMap());
  const result = await engine.migrate(analysis, { dryRun: flags.dryRun ?? false });

  if (flags.dryRun) {
    for (const diff of engine.getPendingDiffs()) {
      printDiff(diff.filePath, diff.before, diff.after);
    }
    printMigrationResult(result);
    ui.dim('\nDry run complete. Re-run without --dry-run to apply.');
    return;
  }

  if (flags.verify !== false) {
    ui.progress('Verifying with the project typechecker…');
    result.verification = new Verifier().verify(project);
    if (result.verification.ran === false && result.verification.output) {
      ui.dim(`  ${result.verification.output}`);
    }
  }

  const reportPath = writeReport(run, result);
  printMigrationResult(result, reportPath);

  ui.line();
  ui.info('Now: run your package manager install, execute the remaining checklist, run tests.');
  if (inRepo) ui.dim('Rollback at any time: git checkout . && git checkout -');
}
