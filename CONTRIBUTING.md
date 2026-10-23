# Contributing

Thanks for helping build the migration engine. The highest-leverage contribution is a **rule**: a breaking change you hit in the wild, encoded once, saves everyone else the same afternoon.

## Setup

```bash
git clone https://github.com/won3er/Upgrade-Assistant
cd upgrade-assistant
npm install
npm run build        # tsc project references (core → plugins → cli)
npm test             # build + vitest (unit + hermetic e2e)
```

Node.js 20+ required. The repo is npm workspaces; packages live in `packages/*`.

Try your local build against the example app:

```bash
node packages/cli/bin/upgrade-assistant.js analyze \
  --dir examples/react18-next14-app \
  --offline --target react@19.0.0 --target next@16.0.0 --target typescript@5.5.4
```

## Contributing a rule

Read the [Plugin Guide](docs/PLUGIN_GUIDE.md) first. Non-negotiables, enforced by the registry and by review:

1. **Official sources only** — every rule cites the vendor's upgrade guide, release notes or reference docs. A rule without sources does not register.
2. **AST, never text replace.**
3. **Autofix only what is mechanically safe**; ambiguous matches get a `note`, not a guess.
4. **Tests**: positive, negative, and fix-output cases (in-memory ts-morph — see any `packages/plugin-*/test`).
5. **`introducedIn` verified** against the changelog, because it controls when your rule runs.

## Contributing a plugin

Open an issue first with the library, the version window you'll cover, and links to the official migration docs. Skeleton: copy `packages/plugin-typescript` (smallest). External plugins can also live in your own repo as `upgrade-assistant-plugin-<name>` — the loader only needs a `MigrationPlugin` default export.

## Code standards

- TypeScript strict mode; ESM; no default exports except plugin entry points.
- Core stays dependency-light (ts-morph, semver — that's it). Justify every new dependency in the PR.
- Engine code returns data; only the CLI prints. No `console.*` in core.
- Public APIs get JSDoc explaining *why*, not just *what*.

## Commits & PRs

- Conventional commits (`feat(plugin-react): …`, `fix(core): …`).
- One logical change per PR. Rules can be batched per library version.
- PR description for rules: link the official source and paste a minimal before/after.

## Reporting migration bugs

If `migrate` produced a wrong edit, include: the rule id (printed in the report), a minimal reproducing snippet, and the diff. Wrong edits are P0 — the tool's entire value is trust.
