import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import typescriptPlugin from '../dist/index.js';
import type { ProjectRule, RuleContext } from '@upgrade-assistant/core';

function projectRule(id: string): ProjectRule {
  const found = typescriptPlugin.rules.find((r) => r.id === id);
  if (!found || found.scope !== 'project') throw new Error(`missing project rule ${id}`);
  return found;
}

function tmpTsconfig(content: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'ua-ts-'));
  const path = join(dir, 'tsconfig.json');
  writeFileSync(
    path,
    typeof content === 'string' ? content : JSON.stringify(content, null, 2),
    'utf8',
  );
  return path;
}

function ctxWith(tsConfigPath: string): RuleContext {
  return { project: { tsConfigPath, rootDir: '/' } } as unknown as RuleContext;
}

describe('typescript/removed-compiler-options', () => {
  const r = projectRule('typescript/removed-compiler-options');

  it('detects removed options and the ES3 target', async () => {
    const path = tmpTsconfig({
      compilerOptions: { importsNotUsedAsValues: 'error', target: 'ES3', strict: true },
    });
    const matches = await r.detect(ctxWith(path));
    expect(matches).toHaveLength(2);
  });

  it('fixes by deleting options and mapping to verbatimModuleSyntax', async () => {
    const path = tmpTsconfig({
      compilerOptions: {
        importsNotUsedAsValues: 'error',
        preserveValueImports: true,
        target: 'ES3',
        strict: true,
      },
    });
    const fixes = await r.applyFix?.(ctxWith(path));
    expect(fixes).toBe(3);
    const result = JSON.parse(readFileSync(path, 'utf8'));
    expect(result.compilerOptions.importsNotUsedAsValues).toBeUndefined();
    expect(result.compilerOptions.preserveValueImports).toBeUndefined();
    expect(result.compilerOptions.verbatimModuleSyntax).toBe(true);
    expect(result.compilerOptions.target).toBe('ES5');
    expect(result.compilerOptions.strict).toBe(true);
  });

  it('downgrades to manual for JSONC tsconfig', async () => {
    const path = tmpTsconfig('{\n  // comment\n  "compilerOptions": { "out": "x" }\n}\n');
    const matches = await r.detect(ctxWith(path));
    expect(matches[0]?.note).toContain('JSONC');
    const fixes = await r.applyFix?.(ctxWith(path));
    expect(fixes).toBe(0);
  });

  it('reports nothing on a clean tsconfig', async () => {
    const path = tmpTsconfig({ compilerOptions: { strict: true, target: 'ES2022' } });
    expect(await r.detect(ctxWith(path))).toHaveLength(0);
  });
});

describe('typescript advisory rules', () => {
  it('surfaces experimentalDecorators as info', async () => {
    const r = projectRule('typescript/standard-decorators-available');
    const path = tmpTsconfig({ compilerOptions: { experimentalDecorators: true } });
    expect(await r.detect(ctxWith(path))).toHaveLength(1);
    expect(r.severity).toBe('info');
  });

  it('suggests bundler moduleResolution', async () => {
    const r = projectRule('typescript/module-resolution-bundler');
    const path = tmpTsconfig({ compilerOptions: { moduleResolution: 'node' } });
    expect(await r.detect(ctxWith(path))).toHaveLength(1);
  });
});
