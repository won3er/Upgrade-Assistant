import { ast, defineRule, type SourceRule } from '@upgrade-assistant/core';

/**
 * With React 19's TypeScript types, useRef() requires an initial argument.
 * TS/TSX files only — plain JS is unaffected.
 */
export const useRefRequiresArgument: SourceRule = defineRule({
  id: 'react/use-ref-requires-argument',
  scope: 'source',
  title: 'useRef() now requires an initial value (TypeScript)',
  description:
    'React 19 types make the argument of useRef mandatory. Calls like useRef<T>() must become ' +
    'useRef<T>(undefined) — or pass a meaningful initial value.',
  introducedIn: '19.0.0',
  severity: 'warning',
  fix: 'autofix',
  sources: [
    {
      title: 'React 19 Upgrade Guide — TypeScript changes',
      url: 'https://react.dev/blog/2024/04/25/react-19-upgrade-guide',
    },
    {
      title: 'types-react-codemod (official types codemods)',
      url: 'https://github.com/eps1lon/types-react-codemod',
    },
  ],
  officialCodemod: 'npx types-react-codemod@latest preset-19 ./src',
  textHints: ['useRef'],
  detect(sf, ctx) {
    if (!isTypeScriptFile(sf)) return [];
    return zeroArgUseRefCalls(sf).map((call) =>
      ast.matchFromNode(call, ctx.project.rootDir, { autofixable: true }),
    );
  },
  applyFix(sf) {
    if (!isTypeScriptFile(sf)) return 0;
    let fixes = 0;
    for (const call of zeroArgUseRefCalls(sf)) {
      call.addArgument('undefined');
      fixes += 1;
    }
    return fixes;
  },
});

function isTypeScriptFile(sf: ast.SourceFile): boolean {
  const path = sf.getFilePath();
  return path.endsWith('.ts') || path.endsWith('.tsx');
}

function zeroArgUseRefCalls(sf: ast.SourceFile) {
  const named = ast.namedImportsOf(sf, 'react', 'useRef').length > 0;
  const receivers = ast.defaultOrNamespaceImportNames(sf, 'react');
  const calls = [
    ...(named ? ast.identifierCalls(sf, 'useRef') : []),
    ...ast.methodCalls(sf, receivers, 'useRef'),
  ];
  return calls.filter((call) => call.getArguments().length === 0);
}
