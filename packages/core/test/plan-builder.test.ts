import { describe, expect, it } from 'vitest';
import { PlanBuilder, assessRisk } from '../dist/index.js';
import type { Finding, UpgradeCandidate } from '../dist/index.js';

const candidate: UpgradeCandidate = {
  plugin: 'react',
  packageName: 'react',
  relatedPackages: ['react-dom'],
  currentVersion: '18.2.0',
  latestVersion: '19.0.0',
  targetVersion: '19.0.0',
  diff: 'major',
};

function finding(partial: Partial<Finding['rule']>, matchCount = 1): Finding {
  return {
    rule: {
      id: 'react/test-rule',
      plugin: 'react',
      packageName: 'react',
      title: 'Test rule',
      description: 'desc',
      introducedIn: '19.0.0',
      severity: 'breaking',
      fix: 'manual',
      sources: [{ title: 't', url: 'https://react.dev' }],
      ...partial,
    },
    matches: Array.from({ length: matchCount }, (_, i) => ({
      filePath: `src/file-${i}.tsx`,
      line: 1,
    })),
  };
}

describe('PlanBuilder', () => {
  it('always starts with the dependency update step', () => {
    const plan = new PlanBuilder().build(candidate, []);
    expect(plan.steps[0]?.kind).toBe('update-dependencies');
    expect(plan.steps[0]?.title).toContain('react-dom');
  });

  it('orders steps: deps → codemods → autofixes → manual', () => {
    const plan = new PlanBuilder().build(candidate, [
      finding({ id: 'react/a', fix: 'manual' }),
      finding({ id: 'react/b', fix: 'autofix' }),
      finding({ id: 'react/c', fix: 'official-codemod' }),
    ]);
    expect(plan.steps.map((s) => s.kind)).toEqual([
      'update-dependencies',
      'official-codemod',
      'autofix',
      'manual',
    ]);
  });

  it('estimates effort from matches, not from changelog size', () => {
    const small = new PlanBuilder().build(candidate, [finding({ fix: 'manual' }, 1)]);
    const large = new PlanBuilder().build(candidate, [finding({ fix: 'manual' }, 10)]);
    expect(large.estimatedMinutes).toBeGreaterThan(small.estimatedMinutes);
  });
});

describe('assessRisk', () => {
  it('is low when nothing is affected', () => {
    expect(assessRisk(candidate, [])).toBe('low');
  });

  it('is medium with any breaking finding', () => {
    expect(assessRisk(candidate, [finding({ fix: 'autofix' })])).toBe('medium');
  });

  it('is high with more than 5 manual breaking matches', () => {
    expect(assessRisk(candidate, [finding({ fix: 'manual' }, 6)])).toBe('high');
  });
});
