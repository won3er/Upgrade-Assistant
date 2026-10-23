import type {
  Finding,
  PlanStep,
  RiskLevel,
  UpgradeCandidate,
  UpgradePlan,
} from '../domain/types.js';

/**
 * Time-estimate heuristic (minutes). Deliberately simple and documented:
 * the point is honest orders of magnitude, not fake precision.
 */
const ESTIMATE = {
  baseline: 10, // install, smoke-test, read the report
  perManualBreakingMatch: 8,
  perManualWarningMatch: 4,
  perAutofixMatch: 0.5, // review the diff
  perOfficialCodemodRule: 5, // run + review
} as const;

/**
 * Builds an ordered, per-upgrade migration plan from findings.
 *
 * Ordering rationale:
 *   1. update dependencies (everything else assumes new versions)
 *   2. run official codemods (they expect pre-migration code… but after
 *      the dep bump, matching each tool's documented flow)
 *   3. apply Upgrade Assistant autofixes
 *   4. manual checklist
 */
export class PlanBuilder {
  build(candidate: UpgradeCandidate, findings: Finding[]): UpgradePlan {
    const steps: PlanStep[] = [];
    let order = 1;

    const packages = [candidate.packageName, ...candidate.relatedPackages];
    steps.push({
      order: order++,
      kind: 'update-dependencies',
      plugin: candidate.plugin,
      title: `Update ${packages.join(', ')} to ${candidate.targetVersion}`,
      detail: `package.json: ${candidate.packageName} ${candidate.currentVersion} → ${candidate.targetVersion}`,
      ruleIds: [],
      files: ['package.json'],
      estimatedMinutes: ESTIMATE.baseline,
    });

    const codemodRules = findings.filter((f) => f.rule.fix === 'official-codemod');
    for (const finding of codemodRules) {
      steps.push({
        order: order++,
        kind: 'official-codemod',
        plugin: candidate.plugin,
        title: `Run official codemod: ${finding.rule.title}`,
        detail: finding.rule.officialCodemod ?? 'See official migration guide.',
        ruleIds: [finding.rule.id],
        files: uniqueFiles(finding),
        estimatedMinutes: ESTIMATE.perOfficialCodemodRule,
      });
    }

    const autofixRules = findings.filter((f) => f.rule.fix === 'autofix');
    if (autofixRules.length > 0) {
      const files = [...new Set(autofixRules.flatMap(uniqueFiles))];
      steps.push({
        order: order++,
        kind: 'autofix',
        plugin: candidate.plugin,
        title: `Apply ${countMatches(autofixRules)} automatic fixes (${autofixRules.length} rules)`,
        detail: autofixRules.map((f) => f.rule.id).join(', '),
        ruleIds: autofixRules.map((f) => f.rule.id),
        files,
        estimatedMinutes: countMatches(autofixRules) * ESTIMATE.perAutofixMatch,
      });
    }

    const manualRules = findings.filter((f) => f.rule.fix === 'manual');
    for (const finding of manualRules) {
      steps.push({
        order: order++,
        kind: 'manual',
        plugin: candidate.plugin,
        title: finding.rule.title,
        detail: finding.rule.description,
        ruleIds: [finding.rule.id],
        files: uniqueFiles(finding),
        estimatedMinutes:
          finding.matches.length *
          (finding.rule.severity === 'breaking'
            ? ESTIMATE.perManualBreakingMatch
            : ESTIMATE.perManualWarningMatch),
      });
    }

    const estimatedMinutes = Math.ceil(steps.reduce((sum, s) => sum + s.estimatedMinutes, 0));
    return {
      candidate,
      findings,
      steps,
      risk: assessRisk(candidate, findings),
      estimatedMinutes,
    };
  }
}

/**
 * Risk reflects YOUR exposure, not the library's changelog size:
 *  - high:   >5 manual breaking matches, or any breaking config change
 *  - medium: any breaking finding, or a major bump with warnings
 *  - low:    everything else
 */
export function assessRisk(candidate: UpgradeCandidate, findings: Finding[]): RiskLevel {
  const manualBreakingMatches = findings
    .filter((f) => f.rule.severity === 'breaking' && f.rule.fix === 'manual')
    .reduce((sum, f) => sum + f.matches.length, 0);
  if (manualBreakingMatches > 5) return 'high';
  if (findings.some((f) => f.rule.severity === 'breaking')) return 'medium';
  if (candidate.diff === 'major' && findings.length > 0) return 'medium';
  return 'low';
}

function uniqueFiles(finding: Finding): string[] {
  return [...new Set(finding.matches.map((m) => m.filePath))];
}

function countMatches(findings: Finding[]): number {
  return findings.reduce((sum, f) => sum + f.matches.length, 0);
}
