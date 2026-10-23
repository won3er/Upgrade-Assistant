# Plugin Guide

A plugin is a curated knowledge base: **what breaks between versions of one library, how to detect it in a real codebase, and how to fix it**. If you can write an ESLint rule, you can write an Upgrade Assistant rule.

## Anatomy of a plugin

```ts
import { definePlugin, detectPackage, type MigrationPlugin } from '@upgrade-assistant/core';
import { myRule } from './rules/my-rule.js';

const plugin: MigrationPlugin = definePlugin({
  name: 'tailwind',                    // unique, lowercase
  displayName: 'Tailwind CSS',
  packageName: 'tailwindcss',          // version detection key
  relatedPackages: ['@tailwindcss/postcss'], // bumped in lockstep
  detect: (project) => detectPackage(project, 'tailwindcss'),
  rules: [myRule],
});

export default plugin;                 // default export is the contract
```

Publish it as `upgrade-assistant-plugin-tailwind`; users enable it via `upgrade-assistant.config.json` → `"plugins": ["upgrade-assistant-plugin-tailwind"]`.

## Anatomy of a rule

Two scopes:

- **`SourceRule`** — evaluated per source file. Gets a ts-morph `SourceFile`.
- **`ProjectRule`** — evaluated once per project (package.json scripts, tsconfig, framework configs).

```ts
import { ast, defineRule, type SourceRule } from '@upgrade-assistant/core';

export const configFileRenamed: SourceRule = defineRule({
  id: 'tailwind/config-import-renamed',        // MUST be '<plugin>/<slug>'
  scope: 'source',
  title: 'tailwind.config import moved',
  description: 'What changed and what the user should do, in plain language.',
  introducedIn: '4.0.0',       // the version where the change LANDS
  severity: 'breaking',        // 'breaking' | 'warning' | 'info'
  fix: 'autofix',              // 'autofix' | 'official-codemod' | 'manual'
  sources: [                   // ≥1 OFFICIAL source. No sources → registry rejects the rule.
    { title: 'Tailwind v4 upgrade guide', url: 'https://tailwindcss.com/docs/upgrade-guide' },
  ],
  officialCodemod: 'npx @tailwindcss/upgrade',  // when the vendor ships one
  textHints: ['tailwindcss/config'],            // cheap pre-filter before AST parsing

  detect(sf, ctx) {
    return ast
      .importsFrom(sf, 'tailwindcss/config')
      .map((decl) => ast.matchFromNode(decl, ctx.project.rootDir, { autofixable: true }));
  },

  applyFix(sf) {
    let fixes = 0;
    for (const decl of ast.importsFrom(sf, 'tailwindcss/config')) {
      decl.setModuleSpecifier('tailwindcss');
      fixes += 1;
    }
    return fixes;
  },
});
```

### The rules of rules

1. **Cite official sources or don't ship.** Upgrade guides, release notes, reference docs, RFCs. Blog posts and Stack Overflow don't qualify. This is enforced at type level (non-empty tuple) *and* at registration.
2. **`introducedIn` drives everything.** The engine only evaluates your rule when the change lands inside the user's upgrade window `(current, target]`. Get this version right.
3. **AST, never text.** Detectors and fixers receive ts-morph nodes. If you find yourself reaching for a regex on file content, model it properly or mark the rule `manual`.
4. **Fix only what is mechanically safe.** The spectrum:
   - `autofix` — the transformation is unambiguous (import moves, argument additions, call rewrites in statement position).
   - `official-codemod` — the vendor ships a codemod; put the exact command in `officialCodemod`. Don't reimplement vendors.
   - `manual` — requires judgment. Your `description` and per-match `note`s are the user's guidance; make them count.
5. **Be honest per match.** `matchFromNode(node, rootDir, { autofixable: false, note: 'why' })` lets one rule autofix the safe occurrences and flag the ambiguous ones. See `react/dom-render-removed` (return value used) and `nextjs/async-request-apis` (sync enclosing function) for the pattern.
6. **Use `textHints`.** A rule that only matters for files importing `next/headers` should not AST-walk 2,000 other files.
7. **Prefer detect-only over wrong-fix.** A false positive costs the user a minute; a wrong edit costs their trust permanently.

## Helper toolbox (`ast` from core)

| Helper | Use |
|---|---|
| `importsFrom(sf, 'react-dom')` | import declarations by module |
| `namedImportsOf(sf, 'react', 'useRef')` | named import specifiers |
| `defaultOrNamespaceImportNames(sf, 'react-dom')` | local receiver names (`ReactDOM`) |
| `methodCalls(sf, ['ReactDOM'], 'render')` | `X.method(...)` call expressions |
| `identifierCalls(sf, 'cookies')` | bare `fn(...)` calls |
| `isAwaited(call)` / `isInsideAsyncFunction(node)` | async-context checks |
| `matchFromNode(node, rootDir, extras?)` | node → serializable `RuleMatch` |
| `Node`, `SyntaxKind` | raw ts-morph guards for anything else |

For config-file edits from `ProjectRule`s, use `editJsonFile` (indent-preserving, refuses JSONC) and `readJsonFile` from core — see `typescript/removed-compiler-options` for the reference implementation, including the JSONC → manual downgrade.

## Testing a rule

In-memory AST, no fixtures on disk:

```ts
import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import plugin from '../dist/index.js';
import type { RuleContext } from '@upgrade-assistant/core';

const ctx = { project: { rootDir: '/' } } as unknown as RuleContext;

function parse(code: string, path = '/src/file.tsx') {
  return new Project({ useInMemoryFileSystem: true, compilerOptions: { jsx: 4 } })
    .createSourceFile(path, code);
}

it('detects and fixes', () => {
  const rule = plugin.rules.find((r) => r.id === 'tailwind/config-import-renamed')!;
  const sf = parse(`import config from 'tailwindcss/config';`);
  expect(rule.detect(sf, ctx)).toHaveLength(1);
  expect(rule.applyFix?.(sf, ctx)).toBe(1);
  expect(sf.getFullText()).toContain(`from 'tailwindcss'`);
});
```

Cover three cases per rule minimum: a positive, a negative (similar code that must NOT match), and the fix output. If your rule has an "ambiguous" path, test that it refuses to fix it.

## Checklist before opening a PR

- [ ] Rule id namespaced under the plugin name
- [ ] `introducedIn` verified against the official changelog
- [ ] Every `sources` URL is official and live
- [ ] `textHints` present for source rules
- [ ] Positive + negative + fix tests
- [ ] Ambiguous matches flagged with a `note`, not guessed
- [ ] Description written for the person doing the migration at 6 pm on a Friday
