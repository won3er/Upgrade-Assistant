/**
 * @upgrade-assistant/core — public API.
 *
 * Plugins should import ONLY from this entrypoint (including the AST
 * helpers, which re-export the ts-morph surface they need).
 */

// Domain
export * from './domain/types.js';
export {
  defineRule,
  definePlugin,
  toRuleMeta,
  type BreakingChangeRule,
  type SourceRule,
  type ProjectRule,
  type RuleContext,
  type MigrationPlugin,
  type DetectedUsage,
} from './domain/rules.js';

// Services
export { ProjectScanner, ProjectScanError } from './scanner/project-scanner.js';
export { Analyzer, type AnalyzeOptions, type AnalyzeOutput } from './analysis/analyzer.js';
export { UsageAnalyzer, ruleApplies } from './analysis/usage-analyzer.js';
export { VersionChecker, resolveCurrentVersion, diffOf } from './versions/version-checker.js';
export { PlanBuilder, assessRisk } from './planning/plan-builder.js';
export { MigrationEngine, type MigrateOptions } from './migration/migration-engine.js';
export { Verifier, detectPackageManager } from './migration/verifier.js';
export { GitService } from './git/git-service.js';
export { ReportGenerator, formatMinutes } from './report/report-generator.js';
export { AnalysisStore } from './store/analysis-store.js';
export { PluginRegistry } from './plugins/plugin-registry.js';

// Registry access
export { type RegistryPort, OfflineRegistry } from './registry/registry-port.js';
export { NpmRegistryClient } from './registry/npm-registry-client.js';

// AST
export { AstService } from './ast/ast-service.js';
export * as ast from './ast/helpers.js';
export type { SourceFile, CallExpression, ImportDeclaration } from 'ts-morph';

// AI (optional layer)
export { type AiProvider, NullAiProvider } from './ai/ai-provider.js';
export { AnthropicProvider } from './ai/anthropic-provider.js';
export { Explainer } from './ai/explainer.js';

// Utilities plugin authors may need
export { editJsonFile, readJsonFile } from './util/json-edit.js';

/**
 * Helper used by plugins to implement `detect()` uniformly: find the
 * package in deps/devDeps and resolve a best-known current version.
 */
import type { DetectedUsage } from './domain/rules.js';
import type { ProjectContext } from './domain/types.js';
import { resolveCurrentVersion as resolveVersion } from './versions/version-checker.js';

export function detectPackage(
  project: ProjectContext,
  packageName: string,
): DetectedUsage | null {
  const prod = project.packageJson.dependencies?.[packageName];
  const dev = project.packageJson.devDependencies?.[packageName];
  const declaredRange = prod ?? dev;
  if (!declaredRange) return null;
  const currentVersion = resolveVersion(declaredRange);
  if (!currentVersion) return null;
  return {
    packageName,
    declaredRange,
    currentVersion,
    kind: prod ? 'prod' : 'dev',
  };
}
