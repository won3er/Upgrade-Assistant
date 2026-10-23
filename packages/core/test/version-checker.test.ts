import { describe, expect, it } from 'vitest';
import { VersionChecker, ruleApplies, type RegistryPort } from '../dist/index.js';

class FakeRegistry implements RegistryPort {
  constructor(private readonly data: Record<string, string[]>) {}
  async getLatestVersion(name: string) {
    return this.data[name]?.at(-1);
  }
  async getVersions(name: string) {
    return this.data[name] ?? [];
  }
}

const reactPluginStub = { name: 'react', relatedPackages: ['react-dom'] } as never;

function detectedReact(currentVersion: string) {
  return [
    {
      plugin: reactPluginStub,
      usage: {
        packageName: 'react',
        declaredRange: `^${currentVersion}`,
        currentVersion,
        kind: 'prod' as const,
      },
    },
  ];
}

describe('VersionChecker', () => {
  it('produces an upgrade candidate when behind latest', async () => {
    const checker = new VersionChecker(new FakeRegistry({ react: ['18.2.0', '19.0.0'] }));
    const { candidates } = await checker.check(detectedReact('18.2.0'));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      packageName: 'react',
      targetVersion: '19.0.0',
      diff: 'major',
    });
  });

  it('classifies up-to-date packages separately', async () => {
    const checker = new VersionChecker(new FakeRegistry({ react: ['19.0.0'] }));
    const { candidates, upToDate } = await checker.check(detectedReact('19.0.0'));
    expect(candidates).toHaveLength(0);
    expect(upToDate).toHaveLength(1);
  });

  it('resolves range targets against published versions', async () => {
    const checker = new VersionChecker(
      new FakeRegistry({ react: ['18.2.0', '18.3.1', '19.0.0'] }),
    );
    const { candidates } = await checker.check(detectedReact('18.2.0'), {
      targets: { react: '18.x' },
    });
    expect(candidates[0]?.targetVersion).toBe('18.3.1');
  });

  it('works offline when a concrete target is pinned', async () => {
    const checker = new VersionChecker(new FakeRegistry({}));
    const { candidates, warnings } = await checker.check(detectedReact('18.2.0'), {
      targets: { react: '19.0.0' },
    });
    expect(candidates[0]?.targetVersion).toBe('19.0.0');
    expect(warnings.some((w) => w.includes('pinned target'))).toBe(true);
  });

  it('skips silently-unknown packages with a warning', async () => {
    const checker = new VersionChecker(new FakeRegistry({}));
    const { candidates, warnings } = await checker.check(detectedReact('18.2.0'));
    expect(candidates).toHaveLength(0);
    expect(warnings).toHaveLength(1);
  });
});

describe('ruleApplies (the upgrade window)', () => {
  const rule = { introducedIn: '19.0.0' } as never;
  it('applies when the change lands inside (current, target]', () => {
    expect(ruleApplies(rule, '18.2.0', '19.0.0')).toBe(true);
    expect(ruleApplies(rule, '18.2.0', '20.1.0')).toBe(true);
  });
  it('does not apply when already on or past the version', () => {
    expect(ruleApplies(rule, '19.0.0', '19.1.0')).toBe(false);
  });
  it('does not apply when the target stops short', () => {
    expect(ruleApplies(rule, '18.0.0', '18.3.1')).toBe(false);
  });
});
