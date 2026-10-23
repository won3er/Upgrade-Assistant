import { ast, defineRule, type SourceRule } from '@upgrade-assistant/core';

/**
 * `act` moved from react-dom/test-utils to react in React 19.
 * Clean import rewrite — the safest kind of autofix.
 */
export const testUtilsActMoved: SourceRule = defineRule({
  id: 'react/test-utils-act-moved',
  scope: 'source',
  title: 'act moved from react-dom/test-utils to react',
  description:
    'React 19 removed act from react-dom/test-utils. Import it from "react" instead: ' +
    "import { act } from 'react'.",
  introducedIn: '19.0.0',
  severity: 'breaking',
  fix: 'autofix',
  sources: [
    {
      title: 'React 19 Upgrade Guide — react-dom/test-utils',
      url: 'https://react.dev/blog/2024/04/25/react-19-upgrade-guide',
    },
  ],
  officialCodemod: 'npx codemod@latest react/19/replace-act-import',
  textHints: ['react-dom/test-utils'],
  detect(sf, ctx) {
    return ast
      .namedImportsOf(sf, 'react-dom/test-utils', 'act')
      .map((spec) => ast.matchFromNode(spec, ctx.project.rootDir, { autofixable: true }));
  },
  applyFix(sf) {
    let fixes = 0;
    for (const decl of ast.importsFrom(sf, 'react-dom/test-utils')) {
      const actSpecifier = decl.getNamedImports().find((n) => n.getName() === 'act');
      if (!actSpecifier) continue;

      const onlyAct =
        decl.getNamedImports().length === 1 && !decl.getDefaultImport() && !decl.getNamespaceImport();

      if (onlyAct) {
        decl.setModuleSpecifier('react');
        mergeDuplicateReactImports(sf);
      } else {
        actSpecifier.remove();
        addNamedReactImport(sf, 'act');
      }
      fixes += 1;
    }
    return fixes;
  },
});

function addNamedReactImport(sf: ast.SourceFile, name: string): void {
  const reactImport = ast
    .importsFrom(sf, 'react')
    .find((d) => d.getNamedImports().length > 0 || d.getDefaultImport() !== undefined);
  if (reactImport) {
    if (!reactImport.getNamedImports().some((n) => n.getName() === name)) {
      reactImport.addNamedImport(name);
    }
    return;
  }
  sf.addImportDeclaration({ moduleSpecifier: 'react', namedImports: [name] });
}

/** After retargeting, collapse `import {act} from 'react'` duplicates. */
function mergeDuplicateReactImports(sf: ast.SourceFile): void {
  const reactImports = ast.importsFrom(sf, 'react');
  if (reactImports.length <= 1) return;
  const [primary, ...rest] = reactImports;
  if (!primary) return;
  for (const extra of rest) {
    const names = extra.getNamedImports().map((n) => n.getName());
    if (extra.getDefaultImport() || extra.getNamespaceImport()) continue;
    for (const name of names) {
      if (!primary.getNamedImports().some((n) => n.getName() === name)) {
        primary.addNamedImport(name);
      }
    }
    extra.remove();
  }
}
