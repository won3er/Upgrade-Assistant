import { ast, defineRule, type SourceRule } from '@upgrade-assistant/core';

const UPGRADE_GUIDE = {
  title: 'React 19 Upgrade Guide — removed APIs',
  url: 'https://react.dev/blog/2024/04/25/react-19-upgrade-guide',
} as const;

/** `Component.propTypes = …` assignments (checks were removed in 19). */
export const propTypesRemoved: SourceRule = defineRule({
  id: 'react/prop-types-removed',
  scope: 'source',
  title: 'propTypes checks are ignored in React 19',
  description:
    'React 19 removed propTypes validation from the React package — assignments are silently ' +
    'ignored. Migrate prop contracts to TypeScript types (recommended) or a runtime validator.',
  introducedIn: '19.0.0',
  severity: 'breaking',
  fix: 'official-codemod',
  sources: [UPGRADE_GUIDE],
  officialCodemod: 'npx codemod@latest react/prop-types-typescript',
  textHints: ['propTypes'],
  detect(sf, ctx) {
    return staticAssignments(sf, 'propTypes').map((node) =>
      ast.matchFromNode(node, ctx.project.rootDir),
    );
  },
});

/**
 * `defaultProps` on FUNCTION components was removed in 19 (class components
 * keep support). Default parameters are the replacement.
 */
export const defaultPropsRemoved: SourceRule = defineRule({
  id: 'react/default-props-function-components',
  scope: 'source',
  title: 'defaultProps on function components was removed',
  description:
    'React 19 removed defaultProps for function components. Use ES6 default parameter values ' +
    'in the destructured props instead. Class components are not affected.',
  introducedIn: '19.0.0',
  severity: 'breaking',
  fix: 'official-codemod',
  sources: [UPGRADE_GUIDE],
  officialCodemod: 'npx codemod@latest react/19/migration-recipe',
  textHints: ['defaultProps'],
  detect(sf, ctx) {
    return staticAssignments(sf, 'defaultProps')
      .filter((node) => !isClassTarget(sf, node))
      .map((node) =>
        ast.matchFromNode(node, ctx.project.rootDir, {
          note: isKnownFunctionTarget(sf, node)
            ? undefined
            : 'component kind could not be resolved statically — verify it is a function component',
        }),
      );
  },
});

/** All `<Identifier>.<staticName> = …` assignments in the file. */
function staticAssignments(sf: ast.SourceFile, staticName: string) {
  const nodes: ast.Node[] = [];
  sf.forEachDescendant((node) => {
    if (!ast.Node.isBinaryExpression(node)) return;
    if (node.getOperatorToken().getKind() !== ast.SyntaxKind.EqualsToken) return;
    const left = node.getLeft();
    if (!ast.Node.isPropertyAccessExpression(left)) return;
    if (left.getName() !== staticName) return;
    if (!ast.Node.isIdentifier(left.getExpression())) return;
    nodes.push(node);
  });
  return nodes;
}

function targetName(node: ast.Node): string | undefined {
  if (!ast.Node.isBinaryExpression(node)) return undefined;
  const left = node.getLeft();
  if (!ast.Node.isPropertyAccessExpression(left)) return undefined;
  return left.getExpression().getText();
}

function isClassTarget(sf: ast.SourceFile, node: ast.Node): boolean {
  const name = targetName(node);
  return name ? sf.getClass(name) !== undefined : false;
}

function isKnownFunctionTarget(sf: ast.SourceFile, node: ast.Node): boolean {
  const name = targetName(node);
  if (!name) return false;
  if (sf.getFunction(name)) return true;
  const variable = sf.getVariableDeclaration(name);
  if (!variable) return false;
  const init = variable.getInitializer();
  return init !== undefined && (ast.Node.isArrowFunction(init) || ast.Node.isFunctionExpression(init));
}
