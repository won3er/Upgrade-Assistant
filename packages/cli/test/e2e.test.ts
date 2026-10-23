import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnalysisResult } from '@upgrade-assistant/core';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const binPath = join(repoRoot, 'packages', 'cli', 'bin', 'upgrade-assistant.js');
const fixture = join(repoRoot, 'examples', 'react18-next14-app');

let projectDir: string;

function runCli(args: string[]) {
  return spawnSync(process.execPath, [binPath, ...args], {
    encoding: 'utf8',
    timeout: 120_000,
  });
}

const OFFLINE_TARGETS = [
  '--offline',
  '--target',
  'react@19.0.0',
  '--target',
  'next@16.0.0',
  '--target',
  'typescript@5.5.4',
];

describe('upgrade-assistant CLI (e2e, offline, hermetic)', () => {
  beforeAll(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'ua-e2e-'));
    cpSync(fixture, projectDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it('analyze --json finds the seeded breaking changes', () => {
    const result = runCli(['analyze', '--dir', projectDir, '--json', ...OFFLINE_TARGETS]);
    expect(result.status).toBe(0);

    const analysis = JSON.parse(result.stdout) as AnalysisResult;
    expect(analysis.schemaVersion).toBe(1);
    expect(analysis.plans.length).toBe(3);

    const ruleIds = analysis.plans.flatMap((p) => p.findings.map((f) => f.rule.id));
    for (const expected of [
      'react/dom-render-removed',
      'react/prop-types-removed',
      'react/string-refs-removed',
      'react/test-utils-act-moved',
      'react/use-ref-requires-argument',
      'nextjs/async-request-apis',
      'nextjs/async-page-props',
      'nextjs/next-lint-removed',
      'nextjs/images-domains-deprecated',
      'nextjs/webpack-config-turbopack-default',
      'typescript/removed-compiler-options',
    ]) {
      expect(ruleIds, `expected finding ${expected}`).toContain(expected);
    }

    // Impact-scoped: only files that actually use the APIs are listed.
    const reactPlan = analysis.plans.find((p) => p.candidate.packageName === 'react');
    const files = new Set(
      reactPlan?.findings.flatMap((f) => f.matches.map((m) => m.filePath)) ?? [],
    );
    expect([...files].some((f) => f.includes('bootstrap'))).toBe(true);
  });

  it('writes MIGRATION_REPORT.md with all sections', () => {
    runCli(['analyze', '--dir', projectDir, ...OFFLINE_TARGETS]);
    const report = readFileSync(join(projectDir, 'MIGRATION_REPORT.md'), 'utf8');
    for (const section of ['# Migration Report', '## Libraries', '## Checklist', '## Official links']) {
      expect(report).toContain(section);
    }
  });

  it('migrate --dry-run previews diffs without touching files', () => {
    const before = readFileSync(join(projectDir, 'src', 'legacy', 'bootstrap.tsx'), 'utf8');
    const result = runCli(['migrate', '--dir', projectDir, '--dry-run', ...OFFLINE_TARGETS]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('createRoot');
    const after = readFileSync(join(projectDir, 'src', 'legacy', 'bootstrap.tsx'), 'utf8');
    expect(after).toBe(before);
  });

  it('migrate --yes applies autofixes, bumps deps and updates tsconfig', () => {
    const result = runCli([
      'migrate',
      '--dir',
      projectDir,
      '--yes',
      '--no-verify',
      ...OFFLINE_TARGETS,
    ]);
    expect(result.status).toBe(0);

    const bootstrap = readFileSync(join(projectDir, 'src', 'legacy', 'bootstrap.tsx'), 'utf8');
    expect(bootstrap).toContain('createRoot(container).render(');
    expect(bootstrap).toContain('hydrateRoot(container, ');
    expect(bootstrap).toContain("from 'react'"); // still imports react

    const page = readFileSync(join(projectDir, 'src', 'app', 'page.tsx'), 'utf8');
    expect(page).toContain('await cookies()');

    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'));
    expect(pkg.dependencies.react).toBe('^19.0.0');
    expect(pkg.dependencies['react-dom']).toBe('^19.0.0');
    expect(pkg.dependencies.next).toBe('^16.0.0');

    const tsconfig = JSON.parse(readFileSync(join(projectDir, 'tsconfig.json'), 'utf8'));
    expect(tsconfig.compilerOptions.importsNotUsedAsValues).toBeUndefined();
    expect(tsconfig.compilerOptions.verbatimModuleSyntax).toBe(true);

    expect(existsSync(join(projectDir, 'MIGRATION_REPORT.md'))).toBe(true);
  });

  it('doctor runs and reports environment status', () => {
    const result = runCli(['doctor', '--dir', projectDir, '--offline']);
    expect(result.stdout).toContain('Node.js >= 20');
    expect(result.stdout).toContain('package.json present');
  });

  it('--skip removes a rule from findings and plan', () => {
    const freshDir = mkdtempSync(join(tmpdir(), 'ua-skip-'));
    cpSync(fixture, freshDir, { recursive: true });
    try {
      const result = runCli(['analyze', '--dir', freshDir, '--json', '--skip', 'react/use-ref-requires-argument', ...OFFLINE_TARGETS]);
      expect(result.status).toBe(0);
      const analysis = JSON.parse(result.stdout) as AnalysisResult;
      const ruleIds = analysis.plans.flatMap((p) => p.findings.map((f) => f.rule.id));
      expect(ruleIds).not.toContain('react/use-ref-requires-argument');
      expect(ruleIds).toContain('react/dom-render-removed'); // others intact
    } finally {
      rmSync(freshDir, { recursive: true, force: true });
    }
  });

  it('--only narrows to one rule and drops unaffected upgrades', () => {
    const freshDir = mkdtempSync(join(tmpdir(), 'ua-only-'));
    cpSync(fixture, freshDir, { recursive: true });
    try {
      const result = runCli(['analyze', '--dir', freshDir, '--json', '--only', 'nextjs/async-request-apis', ...OFFLINE_TARGETS]);
      expect(result.status).toBe(0);
      const analysis = JSON.parse(result.stdout) as AnalysisResult;
      expect(analysis.plans).toHaveLength(1);
      expect(analysis.plans[0]?.candidate.packageName).toBe('next');
      const ruleIds = analysis.plans.flatMap((p) => p.findings.map((f) => f.rule.id));
      expect(ruleIds).toEqual(['nextjs/async-request-apis']);
    } finally {
      rmSync(freshDir, { recursive: true, force: true });
    }
  });

  it('verify reports typecheck status without failing when TS is absent', () => {
    const result = runCli(['verify', '--dir', projectDir]);
    expect(result.status).toBe(0); // fixture has no node_modules → skipped, not failed
    expect(result.stdout).toContain('Verification');
    expect(result.stdout).toContain('TypeScript not installed');
  });

  it('plugins lists the three built-ins with detection', () => {
    const result = runCli(['plugins', '--dir', projectDir]);
    expect(result.stdout).toContain('React');
    expect(result.stdout).toContain('Next.js');
    expect(result.stdout).toContain('TypeScript');
    expect(result.stdout).toContain('detected react@');
  });
});
