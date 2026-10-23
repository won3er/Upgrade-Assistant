/**
 * AST helpers shared by plugins.
 *
 * Plugins import these from `@upgrade-assistant/core` instead of depending
 * on ts-morph directly, which guarantees a single ts-morph version across
 * the whole plugin ecosystem.
 */
import {
  Node,
  SyntaxKind,
  type CallExpression,
  type ImportDeclaration,
  type ImportSpecifier,
  type SourceFile,
} from 'ts-morph';
import type { RuleMatch } from '../domain/types.js';
import { relative } from 'node:path';

export { Node, SyntaxKind };
export type { CallExpression, ImportDeclaration, SourceFile };

/** All import declarations whose module specifier matches exactly. */
export function importsFrom(sf: SourceFile, moduleName: string): ImportDeclaration[] {
  return sf.getImportDeclarations().filter((d) => d.getModuleSpecifierValue() === moduleName);
}

/** Named import specifiers of `name` imported from `moduleName`. */
export function namedImportsOf(
  sf: SourceFile,
  moduleName: string,
  name: string,
): ImportSpecifier[] {
  return importsFrom(sf, moduleName).flatMap((d) =>
    d.getNamedImports().filter((n) => n.getName() === name),
  );
}

/** True when the file imports anything from `moduleName`. */
export function hasImportFrom(sf: SourceFile, moduleName: string): boolean {
  return importsFrom(sf, moduleName).length > 0;
}

/**
 * Local identifiers bound to a default or namespace import of a module —
 * e.g. `import ReactDOM from 'react-dom'` → `['ReactDOM']`.
 */
export function defaultOrNamespaceImportNames(sf: SourceFile, moduleName: string): string[] {
  const names: string[] = [];
  for (const decl of importsFrom(sf, moduleName)) {
    const def = decl.getDefaultImport();
    if (def) names.push(def.getText());
    const ns = decl.getNamespaceImport();
    if (ns) names.push(ns.getText());
  }
  return names;
}

/** Call expressions of the form `<receiver>.<method>(...)`. */
export function methodCalls(
  sf: SourceFile,
  receivers: readonly string[],
  method: string,
): CallExpression[] {
  if (receivers.length === 0) return [];
  const calls: CallExpression[] = [];
  sf.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const expr = node.getExpression();
    if (!Node.isPropertyAccessExpression(expr)) return;
    if (expr.getName() !== method) return;
    if (!receivers.includes(expr.getExpression().getText())) return;
    calls.push(node);
  });
  return calls;
}

/** Call expressions where the callee is a bare identifier `name(...)`. */
export function identifierCalls(sf: SourceFile, name: string): CallExpression[] {
  const calls: CallExpression[] = [];
  sf.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const expr = node.getExpression();
    if (Node.isIdentifier(expr) && expr.getText() === name) calls.push(node);
  });
  return calls;
}

/** Build a serializable {@link RuleMatch} from any AST node. */
export function matchFromNode(
  node: Node,
  rootDir: string,
  extras: Partial<RuleMatch> = {},
): RuleMatch {
  const sf = node.getSourceFile();
  const { line, column } = sf.getLineAndColumnAtPos(node.getStart());
  return {
    filePath: relative(rootDir, sf.getFilePath()),
    line,
    column,
    excerpt: truncate(node.getText().split('\n')[0] ?? '', 100),
    ...extras,
  };
}

/** Nearest enclosing function-like node, if any. */
export function enclosingFunction(node: Node): Node | undefined {
  return node.getFirstAncestor(
    (a) =>
      Node.isFunctionDeclaration(a) ||
      Node.isFunctionExpression(a) ||
      Node.isArrowFunction(a) ||
      Node.isMethodDeclaration(a),
  );
}

/** True when the enclosing function of `node` is declared async. */
export function isInsideAsyncFunction(node: Node): boolean {
  const fn = enclosingFunction(node);
  if (!fn) return false;
  if (
    Node.isFunctionDeclaration(fn) ||
    Node.isFunctionExpression(fn) ||
    Node.isArrowFunction(fn) ||
    Node.isMethodDeclaration(fn)
  ) {
    return fn.isAsync();
  }
  return false;
}

/** True when `call` is directly awaited (`await call(...)`). */
export function isAwaited(call: CallExpression): boolean {
  return Node.isAwaitExpression(call.getParent());
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
