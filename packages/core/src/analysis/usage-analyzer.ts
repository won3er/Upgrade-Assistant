import semver from 'semver';
import type { Finding, ProjectContext, RuleMatch, UpgradeCandidate } from '../domain/types.js';
import {
  toRuleMeta,
  type BreakingChangeRule,
  type MigrationPlugin,
  type RuleContext,
  type SourceRule,
} from '../domain/rules.js';
import type { AstService } from '../ast/ast-service.js';

/**
 * Runs the applicable slice of each plugin's knowledge base against the
 * project's AST and produces findings.
 *
 * "Applicable slice" = rules whose `introducedIn` lies inside
 * (currentVersion, targetVersion]. A React 17→18 project never evaluates
 * React 19 rules, and vice versa.
 */
export class UsageAnalyzer {
  async analyze(
    project: ProjectContext,
    ast: AstService,
    plugin: MigrationPlugin,
    candidate: UpgradeCandidate,
  ): Promise<Finding[]> {
    const applicable = plugin.rules.filter((rule) =>
      ruleApplies(rule, candidate.currentVersion, candidate.targetVersion),
    );
    if (applicable.length === 0) return [];

    validateSources(applicable);
    const ctx: RuleContext = { project, candidate, ast };
    const findings: Finding[] = [];

    for (const rule of applicable) {
      const matches =
        rule.scope === 'source'
          ? this.runSourceRule(rule, ctx)
          : await rule.detect(ctx);
      if (matches.length > 0) {
        findings.push({ rule: toRuleMeta(rule, plugin), matches });
      }
    }

    findings.sort(bySeverityThenId);
    return findings;
  }

  private runSourceRule(rule: SourceRule, ctx: RuleContext): RuleMatch[] {
    const matches: RuleMatch[] = [];
    for (const sf of ctx.ast.getSourceFiles()) {
      // Cheap text pre-filter before walking the AST.
      if (rule.textHints && !rule.textHints.some((h) => sf.getFullText().includes(h))) {
        continue;
      }
      matches.push(...rule.detect(sf, ctx));
    }
    return matches;
  }
}

/** A rule applies when its change lands within the upgrade window. */
export function ruleApplies(
  rule: BreakingChangeRule,
  currentVersion: string,
  targetVersion: string,
): boolean {
  const introduced = semver.coerce(rule.introducedIn);
  const current = semver.coerce(currentVersion);
  const target = semver.coerce(targetVersion);
  if (!introduced || !current || !target) return false;
  return semver.gt(introduced, current) && semver.lte(introduced, target);
}

/** Grounding is not optional: refuse rules without official sources. */
function validateSources(rules: BreakingChangeRule[]): void {
  for (const rule of rules) {
    if (rule.sources.length === 0) {
      throw new Error(`Rule ${rule.id} has no official sources and cannot be used.`);
    }
  }
}

const severityRank = { breaking: 0, warning: 1, info: 2 } as const;

function bySeverityThenId(a: Finding, b: Finding): number {
  return (
    severityRank[a.rule.severity] - severityRank[b.rule.severity] ||
    a.rule.id.localeCompare(b.rule.id)
  );
}
