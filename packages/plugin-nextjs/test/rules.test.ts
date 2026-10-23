import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import nextjsPlugin from '../dist/index.js';
import type { ProjectRule, RuleContext, SourceRule } from '@upgrade-assistant/core';

function parse(code: string, path = '/src/app/page.tsx') {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { jsx: 4, allowJs: true },
  });
  return project.createSourceFile(path, code);
}

const ctx = { project: { rootDir: '/' } } as unknown as RuleContext;

function sourceRule(id: string): SourceRule {
  const found = nextjsPlugin.rules.find((r) => r.id === id);
  if (!found || found.scope !== 'source') throw new Error(`missing source rule ${id}`);
  return found;
}

function projectRule(id: string): ProjectRule {
  const found = nextjsPlugin.rules.find((r) => r.id === id);
  if (!found || found.scope !== 'project') throw new Error(`missing project rule ${id}`);
  return found;
}

describe('nextjs/async-request-apis', () => {
  const r = sourceRule('nextjs/async-request-apis');

  it('awaits cookies() inside an async function', () => {
    const sf = parse(`
import { cookies } from 'next/headers';
export default async function Page() {
  const store = cookies();
  return store.get('theme');
}
`);
    const matches = r.detect(sf, ctx);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.autofixable).toBe(true);
    expect(r.applyFix?.(sf, ctx)).toBe(1);
    expect(sf.getFullText()).toContain('await cookies()');
  });

  it('parenthesizes when part of a member chain', () => {
    const sf = parse(`
import { headers } from 'next/headers';
export async function readAgent() {
  return headers().get('user-agent');
}
`);
    expect(r.applyFix?.(sf, ctx)).toBe(1);
    expect(sf.getFullText()).toContain("(await headers()).get('user-agent')");
  });

  it('refuses to rewrite inside sync functions and explains why', () => {
    const sf = parse(`
import { cookies } from 'next/headers';
export function read() {
  return cookies().get('a');
}
`);
    const matches = r.detect(sf, ctx);
    expect(matches[0]?.autofixable).toBe(false);
    expect(matches[0]?.note).toContain('not async');
    expect(r.applyFix?.(sf, ctx)).toBe(0);
  });

  it('leaves already-awaited calls alone', () => {
    const sf = parse(`
import { cookies } from 'next/headers';
export default async function Page() {
  const store = await cookies();
  return store;
}
`);
    expect(r.detect(sf, ctx)).toHaveLength(0);
  });
});

describe('nextjs/async-page-props', () => {
  const r = sourceRule('nextjs/async-page-props');

  it('flags sync params signatures in app-router entries', () => {
    const sf = parse(`
export default async function Page({ params }: { params: { slug: string } }) {
  return <h1>{params.slug}</h1>;
}
`);
    expect(r.detect(sf, ctx)).toHaveLength(1);
  });

  it('accepts Promise-typed params', () => {
    const sf = parse(`
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <h1>{slug}</h1>;
}
`);
    expect(r.detect(sf, ctx)).toHaveLength(0);
  });

  it('ignores non-entry files', () => {
    const sf = parse(
      `export default function helper({ params }: { params: { x: string } }) { return params.x; }`,
      '/src/lib/helper.tsx',
    );
    expect(r.detect(sf, ctx)).toHaveLength(0);
  });
});

describe('nextjs/next-lint-removed', () => {
  it('finds next lint scripts in package.json', async () => {
    const r = projectRule('nextjs/next-lint-removed');
    const fakeCtx = {
      project: { packageJson: { scripts: { lint: 'next lint', dev: 'next dev' } } },
    } as unknown as RuleContext;
    const matches = await r.detect(fakeCtx);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.excerpt).toContain('next lint');
  });
});

describe('plugin metadata invariants', () => {
  it('every rule cites official nextjs.org (or vendor) sources', () => {
    for (const r of nextjsPlugin.rules) {
      expect(r.sources.length, r.id).toBeGreaterThan(0);
    }
  });
});
