import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import reactPlugin from '../dist/index.js';
import type { RuleContext, SourceRule } from '@upgrade-assistant/core';

function parse(code: string, path = '/src/file.tsx') {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { jsx: 4, allowJs: true },
  });
  return project.createSourceFile(path, code);
}

const ctx = { project: { rootDir: '/' } } as unknown as RuleContext;

function rule(id: string): SourceRule {
  const found = reactPlugin.rules.find((r) => r.id === id);
  if (!found || found.scope !== 'source') throw new Error(`missing source rule ${id}`);
  return found;
}

describe('react/dom-render-removed', () => {
  const r = rule('react/dom-render-removed');

  it('detects ReactDOM.render and rewrites it to createRoot', () => {
    const sf = parse(`
import React from 'react';
import ReactDOM from 'react-dom';
ReactDOM.render(<App />, document.getElementById('root'));
`);
    expect(r.detect(sf, ctx)).toHaveLength(1);
    expect(r.applyFix?.(sf, ctx)).toBe(1);
    const text = sf.getFullText();
    expect(text).toContain("createRoot(document.getElementById('root')).render(<App />)");
    expect(text).toContain('react-dom/client');
  });

  it('flags but does not rewrite when the return value is used', () => {
    const sf = parse(`
import ReactDOM from 'react-dom';
const instance = ReactDOM.render(<App />, node);
`);
    const matches = r.detect(sf, ctx);
    expect(matches[0]?.autofixable).toBe(false);
    expect(r.applyFix?.(sf, ctx)).toBe(0);
  });

  it('handles named imports of render', () => {
    const sf = parse(`
import { render } from 'react-dom';
render(<App />, node);
`);
    expect(r.detect(sf, ctx)).toHaveLength(1);
  });
});

describe('react/dom-hydrate-removed', () => {
  it('flips the argument order to hydrateRoot', () => {
    const r = rule('react/dom-hydrate-removed');
    const sf = parse(`
import ReactDOM from 'react-dom';
ReactDOM.hydrate(<App />, container);
`);
    expect(r.applyFix?.(sf, ctx)).toBe(1);
    expect(sf.getFullText()).toContain('hydrateRoot(container, <App />)');
  });
});

describe('react/test-utils-act-moved', () => {
  it('retargets an act-only import to react', () => {
    const r = rule('react/test-utils-act-moved');
    const sf = parse(`
import { act } from 'react-dom/test-utils';
act(() => {});
`);
    expect(r.detect(sf, ctx)).toHaveLength(1);
    expect(r.applyFix?.(sf, ctx)).toBe(1);
    expect(sf.getFullText()).toContain("from 'react'");
    expect(sf.getFullText()).not.toContain('react-dom/test-utils');
  });

  it('moves act out of a mixed import', () => {
    const r = rule('react/test-utils-act-moved');
    const sf = parse(`
import { act, Simulate } from 'react-dom/test-utils';
`);
    expect(r.applyFix?.(sf, ctx)).toBe(1);
    const text = sf.getFullText();
    expect(text).toContain('Simulate');
    expect(text).toMatch(/import\s*\{\s*act\s*\}\s*from\s*["']react["']/);
  });
});

describe('react/use-ref-requires-argument', () => {
  const r = rule('react/use-ref-requires-argument');

  it('adds undefined to zero-arg useRef in TS files', () => {
    const sf = parse(`
import { useRef } from 'react';
const ref = useRef<HTMLInputElement>();
`);
    expect(r.applyFix?.(sf, ctx)).toBe(1);
    expect(sf.getFullText()).toContain('useRef<HTMLInputElement>(undefined)');
  });

  it('ignores plain JS files', () => {
    const sf = parse(
      `import { useRef } from 'react';\nconst ref = useRef();\n`,
      '/src/file.jsx',
    );
    expect(r.detect(sf, ctx)).toHaveLength(0);
  });
});

describe('react/prop-types-removed & default-props', () => {
  it('detects propTypes assignments', () => {
    const r = rule('react/prop-types-removed');
    const sf = parse(`
function Login() { return null; }
Login.propTypes = {};
`);
    expect(r.detect(sf, ctx)).toHaveLength(1);
  });

  it('skips defaultProps on class components', () => {
    const r = rule('react/default-props-function-components');
    const sf = parse(`
class Button extends React.Component { render() { return null; } }
Button.defaultProps = { kind: 'primary' };
`);
    expect(r.detect(sf, ctx)).toHaveLength(0);
  });

  it('flags defaultProps on function components', () => {
    const r = rule('react/default-props-function-components');
    const sf = parse(`
function Button() { return null; }
Button.defaultProps = { kind: 'primary' };
`);
    expect(r.detect(sf, ctx)).toHaveLength(1);
  });
});

describe('react/string-refs-removed', () => {
  it('detects string refs in JSX', () => {
    const r = rule('react/string-refs-removed');
    const sf = parse(`
class Form extends React.Component {
  render() { return <input ref="nameInput" />; }
}
`);
    expect(r.detect(sf, ctx)).toHaveLength(1);
  });

  it('ignores ref callbacks and ref objects', () => {
    const r = rule('react/string-refs-removed');
    const sf = parse(`const el = <input ref={(node) => register(node)} />;`);
    expect(r.detect(sf, ctx)).toHaveLength(0);
  });
});

describe('plugin metadata invariants', () => {
  it('every rule cites at least one official source', () => {
    for (const r of reactPlugin.rules) {
      expect(r.sources.length, r.id).toBeGreaterThan(0);
      for (const source of r.sources) {
        expect(source.url, r.id).toMatch(/^https:\/\//);
      }
    }
  });
});
