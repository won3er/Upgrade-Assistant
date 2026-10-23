import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import semver from 'semver';
import type {
  AnalysisResult,
  AppliedFix,
  MigrationResult,
  PlanStep,
  ProjectContext,
  UpgradePlan,
} from '../domain/types.js';
import type { MigrationPlugin, RuleContext } from '../domain/rules.js';
import type { AstService } from '../ast/ast-service.js';
import { editJsonFile } from '../util/json-edit.js';

export interface MigrateOptions {
  dryRun?: boolean;
}

/**
 * Executes the automatable part of a plan: dependency bumps in
 * package.json and AST autofixes. Official codemods and manual steps are
 * surfaced, never silently executed — running third-party commands
 * implicitly would be a trust violation.
 */
export class MigrationEngine {
  constructor(
    private readonly project: ProjectContext,
    private readonly ast: AstService,
    private readonly plugins: Map<string, MigrationPlugin>,
  ) {}

  async migrate(analysis: AnalysisResult, options: MigrateOptions = {}): Promise<MigrationResult> {
    const dryRun = options.dryRun ?? false;
    const appliedFixes: AppliedFix[] = [];
    const dependencyUpdates: MigrationResult['dependencyUpdates'] = [];
    const remainingManual: PlanStep[] = [];

    for (const plan of analysis.plans) {
      appliedFixes.push(...(await this.applyAutofixes(plan)));
      remainingManual.push(
        ...plan.steps.filter((s) => s.kind === 'manual' || s.kind === 'official-codemod'),
      );
      dependencyUpdates.push(...this.collectDependencyUpdates(plan));
    }

    const dirtyFiles = this.ast
      .getDirtyFiles()
      .map((sf) => relative(this.project.rootDir, sf.getFilePath()));

    if (!dryRun) {
      await this.ast.save();
      this.applyDependencyUpdates(dependencyUpdates);
    }

    const modifiedFiles = [...new Set(dirtyFiles)];
    if (dependencyUpdates.length > 0) modifiedFiles.push('package.json');

    return {
      dryRun,
      modifiedFiles,
      appliedFixes,
      dependencyUpdates,
      remainingManual,
    };
  }

  /** Pending in-memory changes as before/after pairs — powers `--dry-run`. */
  getPendingDiffs(): { filePath: string; before: string; after: string }[] {
    return this.ast.getDirtyFiles().map((sf) => ({
      filePath: relative(this.project.rootDir, sf.getFilePath()),
      before: safeReadFile(sf.getFilePath()),
      after: sf.getFullText(),
    }));
  }

  private async applyAutofixes(plan: UpgradePlan): Promise<AppliedFix[]> {
    const plugin = this.plugins.get(plan.candidate.plugin);
    if (!plugin) return [];
    const ctx: RuleContext = { project: this.project, candidate: plan.candidate, ast: this.ast };
    const applied: AppliedFix[] = [];

    for (const finding of plan.findings) {
      if (finding.rule.fix !== 'autofix') continue;
      const rule = plugin.rules.find((r) => r.id === finding.rule.id);
      if (!rule) continue;

      if (rule.scope === 'source' && rule.applyFix) {
        const files = new Set(finding.matches.map((m) => m.filePath));
        for (const rel of files) {
          const sf = this.ast.getFile(join(this.project.rootDir, rel));
          if (!sf) continue;
          const count = rule.applyFix(sf, ctx);
          if (count > 0) applied.push({ ruleId: rule.id, filePath: rel, fixesApplied: count });
        }
      } else if (rule.scope === 'project' && rule.applyFix) {
        const count = await rule.applyFix(ctx);
        if (count > 0) {
          applied.push({ ruleId: rule.id, filePath: 'project', fixesApplied: count });
        }
      }
    }
    return applied;
  }

  private collectDependencyUpdates(plan: UpgradePlan): MigrationResult['dependencyUpdates'] {
    const { candidate } = plan;
    const updates: MigrationResult['dependencyUpdates'] = [];
    const allDeps = {
      ...this.project.packageJson.dependencies,
      ...this.project.packageJson.devDependencies,
    };
    for (const name of [candidate.packageName, ...candidate.relatedPackages]) {
      const current = allDeps[name];
      if (!current) continue;
      const to = targetRangeFor(candidate);
      if (current !== to) updates.push({ packageName: name, from: current, to });
    }
    return updates;
  }

  private applyDependencyUpdates(updates: MigrationResult['dependencyUpdates']): void {
    if (updates.length === 0) return;
    editJsonFile(this.project.packageJsonPath, (data) => {
      for (const section of ['dependencies', 'devDependencies'] as const) {
        const deps = data[section] as Record<string, string> | undefined;
        if (!deps) continue;
        for (const update of updates) {
          if (deps[update.packageName] !== undefined) deps[update.packageName] = update.to;
        }
      }
    });
  }
}

/**
 * Related packages follow the primary's target with caret semantics
 * (react-dom and @types/react track react's major, etc.).
 */
function targetRangeFor(candidate: { targetVersion: string }): string {
  const v = semver.coerce(candidate.targetVersion)?.version ?? candidate.targetVersion;
  return `^${v}`;
}

function safeReadFile(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}
