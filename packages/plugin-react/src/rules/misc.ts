import { ast, defineRule, type SourceRule } from '@upgrade-assistant/core';

const UPGRADE_GUIDE = {
  title: 'React 19 Upgrade Guide',
  url: 'https://react.dev/blog/2024/04/25/react-19-upgrade-guide',
} as const;

/** String refs (`ref="myRef"`) were removed in React 19. */
export const stringRefsRemoved: SourceRule = defineRule({
  id: 'react/string-refs-removed',
  scope: 'source',
  title: 'String refs were removed',
  description:
    'React 19 removed string refs. Use a ref callback or useRef()/createRef() and pass the ' +
    'ref object instead.',
  introducedIn: '19.0.0',
  severity: 'breaking',
  fix: 'manual',
  sources: [UPGRADE_GUIDE],
  officialCodemod: 'npx codemod@latest react/19/migration-recipe',
  textHints: ['ref='],
  detect(sf, ctx) {
    const matches: ReturnType<typeof ast.matchFromNode>[] = [];
    sf.forEachDescendant((node) => {
      if (!ast.Node.isJsxAttribute(node)) return;
      if (node.getNameNode().getText() !== 'ref') return;
      const initializer = node.getInitializer();
      if (initializer && ast.Node.isStringLiteral(initializer)) {
        matches.push(ast.matchFromNode(node, ctx.project.rootDir));
      }
    });
    return matches;
  },
});

/** React.createFactory was removed in React 19. */
export const createFactoryRemoved: SourceRule = defineRule({
  id: 'react/create-factory-removed',
  scope: 'source',
  title: 'React.createFactory was removed',
  description:
    'React 19 removed createFactory. Replace factories with JSX or direct createElement calls.',
  introducedIn: '19.0.0',
  severity: 'breaking',
  fix: 'manual',
  sources: [UPGRADE_GUIDE],
  textHints: ['createFactory'],
  detect(sf, ctx) {
    const receivers = ast.defaultOrNamespaceImportNames(sf, 'react');
    const viaReceiver = ast.methodCalls(sf, receivers, 'createFactory');
    const viaNamed =
      ast.namedImportsOf(sf, 'react', 'createFactory').length > 0
        ? ast.identifierCalls(sf, 'createFactory')
        : [];
    return [...viaReceiver, ...viaNamed].map((call) =>
      ast.matchFromNode(call, ctx.project.rootDir),
    );
  },
});

/**
 * In React 19 `ref` is a regular prop for function components; forwardRef
 * is on a deprecation path. Optional modernization — info only, zero noise
 * in the checklist.
 */
export const forwardRefDeprecation: SourceRule = defineRule({
  id: 'react/forward-ref-deprecation-path',
  scope: 'source',
  title: 'forwardRef is no longer necessary',
  description:
    'React 19 passes ref as a normal prop to function components. forwardRef still works but ' +
    'is planned for deprecation — new code can accept ref directly in props.',
  introducedIn: '19.0.0',
  severity: 'info',
  fix: 'manual',
  sources: [
    UPGRADE_GUIDE,
    { title: 'ref as a prop', url: 'https://react.dev/blog/2024/12/05/react-19#ref-as-a-prop' },
  ],
  textHints: ['forwardRef'],
  detect(sf, ctx) {
    return ast
      .namedImportsOf(sf, 'react', 'forwardRef')
      .map((spec) => ast.matchFromNode(spec, ctx.project.rootDir));
  },
});

/** `<Context.Provider>` can become `<Context>` in React 19 (optional). */
export const contextProviderShorthand: SourceRule = defineRule({
  id: 'react/context-as-provider',
  scope: 'source',
  title: '<Context> can replace <Context.Provider>',
  description:
    'React 19 lets you render <Context> directly as the provider. <Context.Provider> keeps ' +
    'working — this is an optional cleanup.',
  introducedIn: '19.0.0',
  severity: 'info',
  fix: 'manual',
  sources: [
    { title: 'React 19 — Context as a provider', url: 'https://react.dev/blog/2024/12/05/react-19#context-as-a-provider' },
  ],
  textHints: ['.Provider'],
  detect(sf, ctx) {
    const matches: ReturnType<typeof ast.matchFromNode>[] = [];
    sf.forEachDescendant((node) => {
      const isOpening = ast.Node.isJsxOpeningElement(node) || ast.Node.isJsxSelfClosingElement(node);
      if (!isOpening) return;
      const tag = node.getTagNameNode().getText();
      if (tag.endsWith('.Provider')) {
        matches.push(ast.matchFromNode(node, ctx.project.rootDir));
      }
    });
    return matches;
  },
});
