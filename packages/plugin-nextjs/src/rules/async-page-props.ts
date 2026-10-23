import { ast, defineRule, type SourceRule } from '@upgrade-assistant/core';

/**
 * In Next.js 15+, `params` and `searchParams` received by pages, layouts
 * and route handlers are Promises.
 *
 * Detect-only by design: rewriting the component signature, its types and
 * every usage is exactly what the official codemod does well — we point to
 * it rather than badly reimplementing it.
 */
export const asyncPageProps: SourceRule = defineRule({
  id: 'nextjs/async-page-props',
  scope: 'source',
  title: 'params and searchParams are now Promises',
  description:
    'Since Next.js 15, params/searchParams passed to pages, layouts, metadata APIs and route ' +
    'handlers are asynchronous. Await them (server components) or unwrap with React.use() ' +
    '(client components).',
  introducedIn: '15.0.0',
  severity: 'breaking',
  fix: 'official-codemod',
  sources: [
    {
      title: 'Next.js 15 Upgrade Guide — async request APIs',
      url: 'https://nextjs.org/docs/app/guides/upgrading/version-15',
    },
  ],
  officialCodemod: 'npx @next/codemod@canary next-async-request-api .',
  textHints: ['params', 'searchParams'],
  detect(sf, ctx) {
    if (!isAppRouterEntry(sf.getFilePath())) return [];
    const matches: ReturnType<typeof ast.matchFromNode>[] = [];

    for (const fn of exportedFunctions(sf)) {
      const firstParam = fn.getParameters()[0];
      if (!firstParam) continue;
      const bindingText = firstParam.getText();
      const usesProps = /\b(params|searchParams)\b/.test(bindingText);
      const alreadyAsyncTyped = /Promise\s*</.test(firstParam.getTypeNode()?.getText() ?? '');
      if (usesProps && !alreadyAsyncTyped) {
        matches.push(
          ast.matchFromNode(firstParam, ctx.project.rootDir, {
            note: 'props signature still assumes synchronous params/searchParams',
          }),
        );
      }
    }
    return matches;
  },
});

/** App-router entry files inside an app dir: page, layout, route, default, template. */
function isAppRouterEntry(filePath: string): boolean {
  const normalized = filePath.replaceAll('\\', '/');
  if (!/\/app\//.test(normalized)) return false;
  return /\/(page|layout|route|default|template)\.(t|j)sx?$/.test(normalized);
}

function exportedFunctions(sf: ast.SourceFile) {
  const fns: (
    | import('ts-morph').FunctionDeclaration
    | import('ts-morph').ArrowFunction
    | import('ts-morph').FunctionExpression
  )[] = [];

  for (const fn of sf.getFunctions()) {
    if (fn.isExported() || fn.isDefaultExport()) fns.push(fn);
  }
  for (const variable of sf.getVariableDeclarations()) {
    if (!variable.getVariableStatement()?.isExported()) continue;
    const init = variable.getInitializer();
    if (init && (ast.Node.isArrowFunction(init) || ast.Node.isFunctionExpression(init))) {
      fns.push(init);
    }
  }
  return fns;
}
