import {
  defineRule,
  editJsonFile,
  readJsonFile,
  type ProjectRule,
  type RuleMatch,
} from '@upgrade-assistant/core';

const TS_5_0 = {
  title: 'Announcing TypeScript 5.0 — deprecations',
  url: 'https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/',
} as const;

const TS_5_5 = {
  title: 'Announcing TypeScript 5.5 — removed options',
  url: 'https://devblogs.microsoft.com/typescript/announcing-typescript-5-5/',
} as const;

/** Options deprecated in 5.0 and rejected by later 5.x compilers. */
const REMOVED_OPTIONS = [
  'charset',
  'out',
  'importsNotUsedAsValues',
  'keyofStringsOnly',
  'noImplicitUseStrict',
  'noStrictGenericChecks',
  'preserveValueImports',
  'suppressExcessPropertyErrors',
  'suppressImplicitAnyIndexErrors',
] as const;

interface TsConfigLike {
  compilerOptions?: Record<string, unknown>;
}

/**
 * TypeScript 5.0 deprecated a set of compiler options (removed in 5.5) and
 * dropped ES3 as a target. This is the classic "build breaks and nobody
 * knows why" upgrade failure — and it is 100% automatable.
 *
 * importsNotUsedAsValues / preserveValueImports are replaced by
 * verbatimModuleSyntax, per the official migration path.
 */
export const removedCompilerOptions: ProjectRule = defineRule({
  id: 'typescript/removed-compiler-options',
  scope: 'project',
  title: 'tsconfig uses compiler options removed in TypeScript 5.x',
  description:
    'TypeScript 5.0 deprecated charset, out, importsNotUsedAsValues, preserveValueImports and ' +
    'friends; TypeScript 5.5 removed them. importsNotUsedAsValues/preserveValueImports map to ' +
    'verbatimModuleSyntax; target ES3 must become ES5 or newer.',
  introducedIn: '5.0.0',
  severity: 'breaking',
  fix: 'autofix',
  sources: [TS_5_0, TS_5_5],
  detect(ctx) {
    const { tsConfigPath } = ctx.project;
    if (!tsConfigPath) return [];
    const config = readJsonFile<TsConfigLike>(tsConfigPath);
    if (!config) {
      return [
        {
          filePath: 'tsconfig.json',
          line: 1,
          note: 'tsconfig.json uses comments (JSONC) — review the removed options manually',
          autofixable: false,
        },
      ];
    }
    const options = config.compilerOptions ?? {};
    const matches: RuleMatch[] = [];
    for (const option of REMOVED_OPTIONS) {
      if (option in options) {
        matches.push({
          filePath: 'tsconfig.json',
          line: 1,
          excerpt: `"${option}": ${JSON.stringify(options[option])}`,
          autofixable: true,
        });
      }
    }
    if (typeof options['target'] === 'string' && options['target'].toLowerCase() === 'es3') {
      matches.push({
        filePath: 'tsconfig.json',
        line: 1,
        excerpt: '"target": "ES3"',
        note: 'ES3 target is no longer supported',
        autofixable: true,
      });
    }
    return matches;
  },
  applyFix(ctx) {
    const { tsConfigPath } = ctx.project;
    if (!tsConfigPath) return 0;
    let fixes = 0;
    const ok = editJsonFile(tsConfigPath, (data) => {
      const options = (data['compilerOptions'] ?? {}) as Record<string, unknown>;
      const needsVerbatim =
        'importsNotUsedAsValues' in options || 'preserveValueImports' in options;
      for (const option of REMOVED_OPTIONS) {
        if (option in options) {
          delete options[option];
          fixes += 1;
        }
      }
      if (needsVerbatim && options['verbatimModuleSyntax'] === undefined) {
        options['verbatimModuleSyntax'] = true;
      }
      if (typeof options['target'] === 'string' && options['target'].toLowerCase() === 'es3') {
        options['target'] = 'ES5';
        fixes += 1;
      }
      data['compilerOptions'] = options;
    });
    return ok ? fixes : 0; // JSONC → refuse, stays on the manual checklist
  },
});

/** experimentalDecorators + TS 5.0 standard decorators: worth knowing. */
export const standardDecoratorsAvailable: ProjectRule = defineRule({
  id: 'typescript/standard-decorators-available',
  scope: 'project',
  title: 'Standard (TC39) decorators are available',
  description:
    'TypeScript 5.0 implements standard decorators, which differ semantically from the ' +
    'experimentalDecorators implementation your project enables. Frameworks like Angular and ' +
    'NestJS still require the experimental flag — only migrate if your stack supports it.',
  introducedIn: '5.0.0',
  severity: 'info',
  fix: 'manual',
  sources: [TS_5_0],
  detect(ctx) {
    const { tsConfigPath } = ctx.project;
    if (!tsConfigPath) return [];
    const config = readJsonFile<TsConfigLike>(tsConfigPath);
    if (config?.compilerOptions?.['experimentalDecorators'] === true) {
      return [
        {
          filePath: 'tsconfig.json',
          line: 1,
          excerpt: '"experimentalDecorators": true',
        },
      ];
    }
    return [];
  },
});

/** moduleResolution "bundler" is the modern setting for bundled apps. */
export const bundlerModuleResolution: ProjectRule = defineRule({
  id: 'typescript/module-resolution-bundler',
  scope: 'project',
  title: 'moduleResolution "bundler" is available',
  description:
    'TypeScript 5.0 added moduleResolution: "bundler", the recommended setting for apps built ' +
    'with Next.js, Vite or other bundlers — it matches how bundlers actually resolve imports.',
  introducedIn: '5.0.0',
  severity: 'info',
  fix: 'manual',
  sources: [TS_5_0],
  detect(ctx) {
    const { tsConfigPath } = ctx.project;
    if (!tsConfigPath) return [];
    const config = readJsonFile<TsConfigLike>(tsConfigPath);
    const resolution = config?.compilerOptions?.['moduleResolution'];
    if (typeof resolution === 'string' && ['node', 'node10'].includes(resolution.toLowerCase())) {
      return [
        {
          filePath: 'tsconfig.json',
          line: 1,
          excerpt: `"moduleResolution": "${resolution}"`,
        },
      ];
    }
    return [];
  },
});
