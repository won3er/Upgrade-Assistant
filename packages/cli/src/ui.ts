import pc from 'picocolors';
import {
  formatMinutes,
  type AnalysisResult,
  type Finding,
  type MigrationResult,
  type UpgradePlan,
} from '@upgrade-assistant/core';

export const ui = {
  title: (text: string) => console.log(`\n${pc.bold(text)}`),
  line: (text = '') => console.log(text),
  success: (text: string) => console.log(`${pc.green('✔')} ${text}`),
  warn: (text: string) => console.log(`${pc.yellow('⚠')} ${text}`),
  fail: (text: string) => console.log(`${pc.red('✖')} ${text}`),
  info: (text: string) => console.log(`${pc.cyan('ℹ')} ${text}`),
  dim: (text: string) => console.log(pc.dim(text)),
  progress: (text: string) => console.log(pc.dim(`  ${text}`)),
};

export function riskLabel(risk: UpgradePlan['risk']): string {
  switch (risk) {
    case 'low':
      return pc.green('low');
    case 'medium':
      return pc.yellow('medium');
    case 'high':
      return pc.red('high');
  }
}

function severityIcon(finding: Finding): string {
  switch (finding.rule.severity) {
    case 'breaking':
      return pc.red('✖');
    case 'warning':
      return pc.yellow('⚠');
    case 'info':
      return pc.cyan('ℹ');
  }
}

function fixBadge(finding: Finding): string {
  switch (finding.rule.fix) {
    case 'autofix':
      return pc.green('[auto-fix available]');
    case 'official-codemod':
      return pc.cyan('[official codemod]');
    case 'manual':
      return pc.yellow('[manual]');
  }
}

export function printAnalysis(analysis: AnalysisResult): void {
  ui.title('Project analyzed');

  if (analysis.plans.length === 0) {
    ui.success('Everything covered by the installed plugins is up to date.');
    printUpToDate(analysis);
    return;
  }

  for (const plan of analysis.plans) {
    const c = plan.candidate;
    ui.line();
    ui.line(
      `${pc.bold(c.packageName)} ${c.currentVersion} → ${pc.bold(c.targetVersion)} ` +
        pc.dim(`(${c.diff ?? 'unknown'})`) +
        `   risk: ${riskLabel(plan.risk)}   estimated: ${pc.bold(formatMinutes(plan.estimatedMinutes))}`,
    );

    if (plan.findings.length === 0) {
      ui.line(pc.dim('  No affected usage found in this project — low-friction upgrade.'));
      continue;
    }

    ui.line(pc.dim('  Breaking changes affecting this project:'));
    for (const finding of plan.findings) {
      const files = new Set(finding.matches.map((m) => m.filePath));
      ui.line(
        `  ${severityIcon(finding)} ${finding.rule.title} ` +
          pc.dim(`— ${finding.matches.length} occurrence(s) in ${files.size} file(s) `) +
          fixBadge(finding),
      );
      for (const file of [...files].slice(0, 5)) {
        ui.line(pc.dim(`      ${file}`));
      }
      if (files.size > 5) ui.line(pc.dim(`      …and ${files.size - 5} more files`));
    }
  }

  printUpToDate(analysis);
  for (const warning of analysis.warnings) ui.warn(warning);
}

function printUpToDate(analysis: AnalysisResult): void {
  if (analysis.upToDate.length === 0) return;
  ui.line();
  ui.line(
    pc.dim(
      `Up to date: ${analysis.upToDate.map((c) => `${c.packageName}@${c.currentVersion}`).join(', ')}`,
    ),
  );
}

export function printPlanSteps(analysis: AnalysisResult): void {
  for (const plan of analysis.plans) {
    const c = plan.candidate;
    ui.title(`Plan: ${c.packageName} ${c.currentVersion} → ${c.targetVersion}`);
    for (const step of plan.steps) {
      const badge =
        step.kind === 'autofix'
          ? pc.green('auto')
          : step.kind === 'official-codemod'
            ? pc.cyan('codemod')
            : step.kind === 'manual'
              ? pc.yellow('manual')
              : pc.magenta('deps');
      ui.line(
        `  ${step.order}. [${badge}] ${step.title} ${pc.dim(`≈${formatMinutes(step.estimatedMinutes)}`)}`,
      );
      if (step.kind === 'official-codemod' || step.kind === 'manual') {
        ui.line(pc.dim(`       ${step.detail}`));
      }
    }
    ui.line(
      `  Total: ${pc.bold(formatMinutes(plan.estimatedMinutes))}, risk ${riskLabel(plan.risk)}`,
    );
  }
}

export function printMigrationResult(result: MigrationResult, reportPath?: string): void {
  ui.title(result.dryRun ? 'Dry run — nothing written' : 'Migration applied');
  ui.success(`${result.modifiedFiles.length} file(s) ${result.dryRun ? 'would be' : ''} modified`);
  const fixCount = result.appliedFixes.reduce((s, f) => s + f.fixesApplied, 0);
  if (fixCount > 0) ui.success(`${fixCount} automatic fix(es) applied`);
  for (const dep of result.dependencyUpdates) {
    ui.success(`${dep.packageName}: ${dep.from} → ${dep.to}`);
  }
  if (result.remainingManual.length > 0) {
    ui.warn(`${result.remainingManual.length} step(s) still need you:`);
    for (const step of result.remainingManual) {
      ui.line(`    • ${step.title}`);
    }
  }
  if (result.verification?.ran) {
    if (result.verification.typecheckPassed) {
      ui.success('Verification: typecheck passed');
    } else {
      ui.fail(
        `Verification: typecheck failed with ${result.verification.errorCount} error(s) — review before committing`,
      );
    }
  }
  if (reportPath) ui.info(`Migration Report: ${reportPath}`);
}

/** Compact line diff (LCS-based) for --dry-run output. */
export function printDiff(filePath: string, before: string, after: string): void {
  ui.line();
  ui.line(pc.bold(pc.underline(filePath)));
  const a = before.split('\n');
  const b = after.split('\n');
  for (const part of diffLines(a, b)) {
    if (part.kind === 'same') continue;
    const prefix = part.kind === 'add' ? pc.green('+ ') : pc.red('- ');
    const paint = part.kind === 'add' ? pc.green : pc.red;
    for (const line of part.lines) ui.line(prefix + paint(line));
  }
}

interface DiffPart {
  kind: 'same' | 'add' | 'del';
  lines: string[];
}

function diffLines(a: string[], b: string[]): DiffPart[] {
  const m = a.length;
  const n = b.length;
  // LCS table — files in a migration diff are small enough for O(m*n).
  const table: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      table[i]![j] =
        a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const parts: DiffPart[] = [];
  const push = (kind: DiffPart['kind'], line: string) => {
    const last = parts.at(-1);
    if (last && last.kind === kind) last.lines.push(line);
    else parts.push({ kind, lines: [line] });
  };
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      push('same', a[i]!);
      i++;
      j++;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      push('del', a[i]!);
      i++;
    } else {
      push('add', b[j]!);
      j++;
    }
  }
  while (i < m) push('del', a[i++]!);
  while (j < n) push('add', b[j++]!);
  return parts;
}
