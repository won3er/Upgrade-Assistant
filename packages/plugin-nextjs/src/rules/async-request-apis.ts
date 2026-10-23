import { ast, defineRule, type SourceRule } from '@upgrade-assistant/core';

const V15_GUIDE = {
  title: 'Next.js 15 Upgrade Guide — async request APIs',
  url: 'https://nextjs.org/docs/app/guides/upgrading/version-15',
} as const;

const OFFICIAL_CODEMOD = 'npx @next/codemod@canary next-async-request-api .';

const ASYNC_APIS = ['cookies', 'headers', 'draftMode'] as const;

/**
 * Next.js 15 made request APIs asynchronous: cookies(), headers() and
 * draftMode() from `next/headers` must be awaited.
 *
 * Autofix policy: when the call sits inside an `async` function we wrap it
 * with `await` (parenthesized when part of a member chain). When the
 * enclosing function is synchronous, converting it to async changes the
 * function's contract for every caller — that judgment belongs to a human,
 * so we flag it instead.
 */
export const asyncRequestApis: SourceRule = defineRule({
  id: 'nextjs/async-request-apis',
  scope: 'source',
  title: 'cookies(), headers() and draftMode() must be awaited',
  description:
    'Since Next.js 15 the request APIs from "next/headers" return Promises. Every call must ' +
    'be awaited (and its enclosing function must be async).',
  introducedIn: '15.0.0',
  severity: 'breaking',
  fix: 'autofix',
  sources: [
    V15_GUIDE,
    {
      title: 'Dynamic APIs are now asynchronous',
      url: 'https://nextjs.org/docs/messages/sync-dynamic-apis',
    },
  ],
  officialCodemod: OFFICIAL_CODEMOD,
  textHints: ['next/headers'],
  detect(sf, ctx) {
    return unawaitedCalls(sf).map(({ call, insideAsync }) =>
      ast.matchFromNode(call, ctx.project.rootDir, {
        autofixable: insideAsync,
        note: insideAsync
          ? undefined
          : 'enclosing function is not async — make it async and await this call',
      }),
    );
  },
  applyFix(sf) {
    let fixes = 0;
    // Re-query after each edit: replaceWithText invalidates descendants.
    let edited = true;
    while (edited) {
      edited = false;
      for (const { call, insideAsync } of unawaitedCalls(sf)) {
        if (!insideAsync) continue;
        const parent = call.getParent();
        const needsParens = parent !== undefined && ast.Node.isPropertyAccessExpression(parent);
        call.replaceWithText(needsParens ? `(await ${call.getText()})` : `await ${call.getText()}`);
        fixes += 1;
        edited = true;
        break;
      }
    }
    return fixes;
  },
});

function unawaitedCalls(sf: ast.SourceFile) {
  const results: { call: ast.CallExpression; insideAsync: boolean }[] = [];
  for (const api of ASYNC_APIS) {
    if (ast.namedImportsOf(sf, 'next/headers', api).length === 0) continue;
    for (const call of ast.identifierCalls(sf, api)) {
      if (ast.isAwaited(call)) continue;
      results.push({ call, insideAsync: ast.isInsideAsyncFunction(call) });
    }
  }
  return results;
}
