import { ast, defineRule, type SourceRule } from '@upgrade-assistant/core';

const UPGRADE_GUIDE = {
  title: 'React 19 Upgrade Guide',
  url: 'https://react.dev/blog/2024/04/25/react-19-upgrade-guide',
} as const;

const REACT_19_RECIPE = 'npx codemod@latest react/19/migration-recipe';

function renderLikeCalls(sf: import('@upgrade-assistant/core').SourceFile, method: string) {
  const receivers = ast.defaultOrNamespaceImportNames(sf, 'react-dom');
  const viaReceiver = ast.methodCalls(sf, receivers, method);
  const viaNamed =
    ast.namedImportsOf(sf, 'react-dom', method).length > 0
      ? ast.identifierCalls(sf, method)
      : [];
  return [...viaReceiver, ...viaNamed];
}

/**
 * ReactDOM.render was removed in React 19 (deprecated since 18).
 * Autofix: `ReactDOM.render(el, container)` → `createRoot(container).render(el)`.
 * Only statement-position calls are rewritten; anything using the legacy
 * return value is flagged for manual review instead of guessing.
 */
export const domRenderRemoved: SourceRule = defineRule({
  id: 'react/dom-render-removed',
  scope: 'source',
  title: 'ReactDOM.render was removed',
  description:
    'React 19 removed ReactDOM.render. Create a root with createRoot(container) from ' +
    '"react-dom/client" and call root.render(element).',
  introducedIn: '19.0.0',
  severity: 'breaking',
  fix: 'autofix',
  sources: [
    UPGRADE_GUIDE,
    { title: 'createRoot reference', url: 'https://react.dev/reference/react-dom/client/createRoot' },
  ],
  officialCodemod: REACT_19_RECIPE,
  textHints: ['render('],
  detect(sf, ctx) {
    return renderLikeCalls(sf, 'render').map((call) =>
      ast.matchFromNode(call, ctx.project.rootDir, {
        autofixable: ast.Node.isExpressionStatement(call.getParent()),
        note: ast.Node.isExpressionStatement(call.getParent())
          ? undefined
          : 'return value of render() is used — review manually',
      }),
    );
  },
  applyFix(sf) {
    let fixes = 0;
    for (const call of renderLikeCalls(sf, 'render')) {
      if (!ast.Node.isExpressionStatement(call.getParent())) continue;
      const [element, container] = call.getArguments().map((a) => a.getText());
      if (!element || !container) continue;
      call.replaceWithText(`createRoot(${container}).render(${element})`);
      fixes += 1;
    }
    if (fixes > 0) ensureCreateRootImport(sf);
    return fixes;
  },
});

/**
 * ReactDOM.hydrate was removed in React 19.
 * Note the argument flip: hydrate(el, container) → hydrateRoot(container, el).
 */
export const domHydrateRemoved: SourceRule = defineRule({
  id: 'react/dom-hydrate-removed',
  scope: 'source',
  title: 'ReactDOM.hydrate was removed',
  description:
    'React 19 removed ReactDOM.hydrate. Use hydrateRoot(container, element) from ' +
    '"react-dom/client" — note the inverted argument order.',
  introducedIn: '19.0.0',
  severity: 'breaking',
  fix: 'autofix',
  sources: [
    UPGRADE_GUIDE,
    { title: 'hydrateRoot reference', url: 'https://react.dev/reference/react-dom/client/hydrateRoot' },
  ],
  officialCodemod: REACT_19_RECIPE,
  textHints: ['hydrate('],
  detect(sf, ctx) {
    return renderLikeCalls(sf, 'hydrate').map((call) =>
      ast.matchFromNode(call, ctx.project.rootDir, {
        autofixable: ast.Node.isExpressionStatement(call.getParent()),
      }),
    );
  },
  applyFix(sf) {
    let fixes = 0;
    for (const call of renderLikeCalls(sf, 'hydrate')) {
      if (!ast.Node.isExpressionStatement(call.getParent())) continue;
      const [element, container] = call.getArguments().map((a) => a.getText());
      if (!element || !container) continue;
      call.replaceWithText(`hydrateRoot(${container}, ${element})`);
      fixes += 1;
    }
    if (fixes > 0) ensureClientImport(sf, 'hydrateRoot');
    return fixes;
  },
});

/**
 * unmountComponentAtNode was removed. Rewriting requires the root instance
 * created elsewhere, so this is detect-only by design.
 */
export const unmountRemoved: SourceRule = defineRule({
  id: 'react/unmount-component-removed',
  scope: 'source',
  title: 'unmountComponentAtNode was removed',
  description:
    'React 19 removed unmountComponentAtNode. Keep a reference to the root created with ' +
    'createRoot()/hydrateRoot() and call root.unmount() instead.',
  introducedIn: '19.0.0',
  severity: 'breaking',
  fix: 'manual',
  sources: [UPGRADE_GUIDE],
  textHints: ['unmountComponentAtNode'],
  detect(sf, ctx) {
    return renderLikeCalls(sf, 'unmountComponentAtNode').map((call) =>
      ast.matchFromNode(call, ctx.project.rootDir),
    );
  },
});

function ensureCreateRootImport(sf: import('@upgrade-assistant/core').SourceFile): void {
  ensureClientImport(sf, 'createRoot');
}

function ensureClientImport(
  sf: import('@upgrade-assistant/core').SourceFile,
  name: string,
): void {
  const existing = ast.importsFrom(sf, 'react-dom/client')[0];
  if (existing) {
    if (!existing.getNamedImports().some((n) => n.getName() === name)) {
      existing.addNamedImport(name);
    }
    return;
  }
  sf.addImportDeclaration({ moduleSpecifier: 'react-dom/client', namedImports: [name] });
}
