import { describe, expect, it } from 'vitest';
import { ReportGenerator, PlanBuilder } from '../dist/index.js';
import type { AnalysisResult, Finding, UpgradeCandidate } from '../dist/index.js';

const candidate: UpgradeCandidate = {
  plugin: 'react',
  packageName: 'react',
  relatedPackages: [],
  currentVersion: '18.2.0',
  latestVersion: '19.0.0',
  targetVersion: '19.0.0',
  diff: 'major',
};

const finding: Finding = {
  rule: {
    id: 'react/dom-render-removed',
    plugin: 'react',
    packageName: 'react',
    title: 'ReactDOM.render was removed',
    description: 'Use createRoot.',
    introducedIn: '19.0.0',
    severity: 'breaking',
    fix: 'autofix',
    sources: [{ title: 'React 19 Upgrade Guide', url: 'https://react.dev/blog/react-19' }],
  },
  matches: [{ filePath: 'src/main.tsx', line: 8 }],
};

function analysis(): AnalysisResult {
  const plan = new PlanBuilder().build(candidate, [finding]);
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    rootDir: '/project',
    projectName: 'demo',
    candidates: [candidate],
    plans: [plan],
    upToDate: [],
    warnings: [],
  };
}

describe('ReportGenerator', () => {
  it('renders every required section', () => {
    const md = new ReportGenerator().toMarkdown(analysis());
    for (const section of [
      '# Migration Report',
      '## Summary',
      '## Libraries',
      '## react 18.2.0 → 19.0.0',
      '### Breaking changes affecting this project',
      '### Plan',
      '## Checklist',
      '## Official links',
    ]) {
      expect(md).toContain(section);
    }
    expect(md).toContain('src/main.tsx:8');
    expect(md).toContain('https://react.dev/blog/react-19');
  });

  it('celebrates an up-to-date project', () => {
    const md = new ReportGenerator().toMarkdown({
      ...analysis(),
      plans: [],
      candidates: [],
    });
    expect(md).toContain('up to date');
  });
});
