# Example: deliberately outdated app

React 18.2 + Next.js 14.2 + TypeScript 4.9, seeded with real migration hazards:

| File | Seeded hazards |
|---|---|
| `src/legacy/bootstrap.tsx` | `ReactDOM.render`, `hydrate`, `unmountComponentAtNode`, string ref |
| `src/components/Login.tsx` | `propTypes`, `defaultProps` on a function component, zero-arg `useRef()`, `forwardRef`, `<Context.Provider>` |
| `src/components/Login.test.tsx` | `act` imported from `react-dom/test-utils` |
| `src/app/page.tsx` | un-awaited `cookies()`/`draftMode()`, sync `params`/`searchParams` types |
| `src/app/layout.tsx` | `headers()` inside a **sync** function (tests the flag-don't-fix path) |
| `next.config.js` | `images.domains`, custom `webpack()` (Turbopack default in 16) |
| `tsconfig.json` | `importsNotUsedAsValues`, `preserveValueImports`, `moduleResolution: node` |
| `package.json` | `next lint` script (removed in 16) |

From the repo root (after `npm install && npm run build`):

```bash
# Analyze (offline, pinned targets — no registry needed)
node packages/cli/bin/upgrade-assistant.js analyze \
  --dir examples/react18-next14-app \
  --offline --target react@19.0.0 --target next@16.0.0 --target typescript@5.5.4

# Preview the automated edits
node packages/cli/bin/upgrade-assistant.js migrate --dir examples/react18-next14-app \
  --dry-run --offline --target react@19.0.0 --target next@16.0.0 --target typescript@5.5.4
```

Tip: copy the folder somewhere else before running a real `migrate`, so the seeded hazards stay in place for the next demo. The e2e suite does exactly that (temp-dir copy).
