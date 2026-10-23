/**
 * Rule and plugin contracts.
 *
 * A migration plugin is, at its heart, a curated list of breaking-change
 * rules. Each rule is declarative data (id, semver, severity, official
 * sources) plus two small functions: `detect` and, optionally, `applyFix`.
 *
 * Design principles:
 *
 * 1. GROUNDED BY DESIGN — `sources` is a non-empty tuple. A rule that
 *    cannot cite an official document does not typecheck.
 * 2. AST OVER TEXT — detectors and fixers receive a ts-morph SourceFile.
 *    Plain-text replacement is not part of the contract.
 * 3. SERIALIZABLE CORE — behavior lives here; everything reported to the
 *    user is projected onto {@link RuleMeta}.
 */
import type { SourceFile } from 'ts-morph';
import type {
  FixKind,
  OfficialSource,
  ProjectContext,
  RuleMatch,
  RuleMeta,
  Severity,
  UpgradeCandidate,
} from './types.js';
import type { AstService } from '../ast/ast-service.js';

/** Context handed to every detector and fixer. */
export interface RuleContext {
  project: ProjectContext;
  candidate: UpgradeCandidate;
  ast: AstService;
}

interface BaseRule {
  /** Stable id, `<plugin>/<slug>` — e.g. `react/dom-render-removed`. */
  id: string;
  title: string;
  /** What changed and what the user must do, in plain language. */
  description: string;
  /** Version of the target package in which the change lands. */
  introducedIn: string;
  severity: Severity;
  fix: FixKind;
  /** At least one official source is required — enforced by the type. */
  sources: readonly [OfficialSource, ...OfficialSource[]];
  /** Exact official codemod command, when one exists. */
  officialCodemod?: string;
  /**
   * Fast pre-filter: if provided, a source file is only parsed when its
   * raw text contains at least one of these substrings.
   */
  textHints?: readonly string[];
}

/** A rule evaluated once per source file. */
export interface SourceRule extends BaseRule {
  scope: 'source';
  detect(file: SourceFile, ctx: RuleContext): RuleMatch[];
  /**
   * Fix all fixable occurrences in the file. Must only perform AST edits.
   * Returns the number of fixes applied (0 = nothing changed).
   */
  applyFix?(file: SourceFile, ctx: RuleContext): number;
}

/** A rule evaluated once per project (configs, package.json, scripts…). */
export interface ProjectRule extends BaseRule {
  scope: 'project';
  detect(ctx: RuleContext): RuleMatch[] | Promise<RuleMatch[]>;
  /** Structured (never regex) edit of config files. Returns fixes applied. */
  applyFix?(ctx: RuleContext): number | Promise<number>;
}

export type BreakingChangeRule = SourceRule | ProjectRule;

/** What a plugin reports when it recognizes the project uses its package. */
export interface DetectedUsage {
  packageName: string;
  declaredRange: string;
  /** Best-known concrete current version. */
  currentVersion: string;
  kind: 'prod' | 'dev';
}

/**
 * A migration plugin. One per library/framework/tool.
 *
 * Plugins are pure data + pure functions: they never touch the network,
 * never write files directly and never call the AI. The engine owns all
 * side effects, which keeps plugins trivial to test and to contribute.
 */
export interface MigrationPlugin {
  /** Short unique name: `react`, `nextjs`, `typescript`. */
  name: string;
  displayName: string;
  /** Primary npm package whose version drives this plugin. */
  packageName: string;
  /** Packages that must be upgraded in lockstep. */
  relatedPackages?: string[];
  /** Report usage of this package in the scanned project, or null. */
  detect(project: ProjectContext): DetectedUsage | null;
  /** The curated breaking-change knowledge base. */
  rules: BreakingChangeRule[];
}

/** Identity helper that preserves literal types and documents intent. */
export function defineRule<T extends BreakingChangeRule>(rule: T): T {
  return rule;
}

/** Identity helper for plugin authors. */
export function definePlugin(plugin: MigrationPlugin): MigrationPlugin {
  return plugin;
}

/** Project the behavioral rule onto its serializable meta. */
export function toRuleMeta(
  rule: BreakingChangeRule,
  plugin: MigrationPlugin,
): RuleMeta {
  return {
    id: rule.id,
    plugin: plugin.name,
    packageName: plugin.packageName,
    title: rule.title,
    description: rule.description,
    introducedIn: rule.introducedIn,
    severity: rule.severity,
    fix: rule.fix,
    sources: [...rule.sources],
    officialCodemod: rule.officialCodemod,
  };
}
