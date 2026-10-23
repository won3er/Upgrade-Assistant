# Upgrade Assistant

> **The migration engine for your codebase.** It understands your project, finds the breaking changes that actually affect *your* code, plans the migration, and applies the safe parts automatically.

Dependency bots tell you a new major exists. Upgrade Assistant tells you **what it breaks in your project, in which files, how long the fix will take — and then fixes the mechanical parts itself.**

```
$ upgrade-assistant analyze

Project analyzed

react 18.2.0 → 19.0.0 (major)   risk: medium   estimated: 46 min
  Breaking changes affecting this project:
  ✖ ReactDOM.render was removed — 1 occurrence in 1 file [auto-fix available]
      src/legacy/bootstrap.tsx
  ✖ propTypes checks are ignored in React 19 — 1 occurrence in 1 file [official codemod]
      src/components/Login.tsx
  ✖ act moved from react-dom/test-utils to react — 1 occurrence in 1 file [auto-fix available]
      src/components/Login.test.tsx
  ⚠ useRef() now requires an initial value (TypeScript) — 1 occurrence [auto-fix available]
      src/components/Login.tsx

next 14.2.3 → 16.0.0 (major)   risk: medium   estimated: 33 min
  ✖ cookies(), headers() and draftMode() must be awaited — 3 occurrences in 2 files [auto-fix available]
  ✖ The `next lint` command was removed — package.json [manual]

typescript 4.9.5 → 5.5.4 (major)   risk: medium   estimated: 15 min
  ✖ tsconfig uses compiler options removed in TypeScript 5.x [auto-fix available]

ℹ Full report: ./MIGRATION_REPORT.md
```

```
$ upgrade-assistant migrate

✔ 6 file(s) modified
✔ 8 automatic fix(es) applied
✔ react: ^18.2.0 → ^19.0.0
✔ next: ^14.2.3 → ^16.0.0
✔ Verification: typecheck passed
⚠ 4 step(s) still need you (see checklist in MIGRATION_REPORT.md)
ℹ Created branch upgrade-assistant/2026-07-07
```

## Why another tool?

| | Renovate / Dependabot | npm-check-updates | codemod.com | **Upgrade Assistant** |
|---|---|---|---|---|
| Finds new versions | ✅ | ✅ | — | ✅ |
| Knows the breaking changes | ❌ | ❌ | per codemod | ✅ curated, source-linked |
| Knows which of them affect **your** code | ❌ | ❌ | ❌ | ✅ AST impact analysis |
| Risk & effort estimate for your project | ❌ | ❌ | ❌ | ✅ |
| Applies fixes | ❌ (bump only) | ❌ | ✅ runs transforms | ✅ AST autofixes + points to official codemods |
| Verifies afterwards | CI, after the fact | ❌ | ❌ | ✅ local typecheck loop |
| Works offline / air-gapped | ❌ | ❌ | partially | ✅ (`--offline --target`) |

The gap in today's ecosystem: version bots stop at `package.json`, and codemod runners start at the transform. Nobody owns the middle — *"what exactly will break in MY project, and what's the plan?"*. That middle is this tool.

## Install

```bash
npm install -g upgrade-assistant   # or: npx upgrade-assistant analyze
```

Requires Node.js 20+.

## Commands

| Command | What it does |
|---|---|
| `upgrade-assistant analyze` | Full analysis: upgrades, impacted files, risk, effort. Writes `MIGRATION_REPORT.md`. |
| `upgrade-assistant check` | Fast version check only (no AST parsing). |
| `upgrade-assistant plan` | The ordered step-by-step migration plan with estimates. |
| `upgrade-assistant migrate` | Apply dependency bumps + AST autofixes. `--dry-run` previews diffs. |
| `upgrade-assistant verify` | Typecheck the project; `--tests` also runs your test suite. CI-ready exit codes. |
| `upgrade-assistant doctor` | Environment sanity: node, git, registry, plugins, AI. |
| `upgrade-assistant report` | Regenerate the Markdown report from the last analysis. |
| `upgrade-assistant plugins` | List installed plugins and what they detected. |

Useful flags: `--json` (CI-friendly output), `--target react@19.0.0` (pin a version; also enables `--offline` analysis), `--only <rule-id>` / `--skip <rule-id>` (per-rule control over analyze/plan/migrate), `--dry-run`, `--explain` (AI briefing, optional).

## Safety model

`migrate` is engineered to be boring:

1. **Re-analyzes before writing** — never applies fixes from a stale cache.
2. **Refuses a dirty git tree** — uncommitted *tracked* changes block the run (your rollback is `git checkout .`).
3. **Works on a dedicated branch** by default (`--no-branch` to opt out).
4. **Asks before writing** (`--yes` to skip, `--dry-run` to preview unified diffs).
5. **All edits are AST transformations** (ts-morph) or structured JSON edits — never regex replace. Anything ambiguous is *flagged, not guessed*: e.g. `cookies()` inside a sync function is reported with "make the function async" instead of silently changing your function's contract.
6. **Verifies afterwards** with your project's own `tsc --noEmit`.
7. **Never runs third-party codemods implicitly** — official codemods are recommended with the exact command, you run them.

## Grounded by design

Every breaking-change rule in every plugin **must cite official sources** (upgrade guides, release notes, reference docs) — the plugin registry rejects rules without them, and the report links each finding to its official documentation.

The AI layer is optional and fenced: it only turns the deterministic analysis into a prose briefing (`analyze --explain`, requires `ANTHROPIC_API_KEY`). It never decides what changed between versions and never edits code. No API key → the tool works fully, just without prose.

## Plugins (MVP)

| Plugin | Coverage | Rules |
|---|---|---|
| **react** | React 18 → 19 (removed APIs, act move, TS types, optional modernizations) | 11 |
| **nextjs** | Next.js 14/15 → 16 (async request APIs, next lint/AMP removal, Turbopack default, image config) | 7 |
| **typescript** | TS 4.x → 5.x (removed compiler options → `verbatimModuleSyntax`, ES3 target, advisories) | 3 |

Each plugin is a curated knowledge base of declarative rules + AST detectors/fixers. Writing one is deliberately similar to writing an ESLint rule — see the [Plugin Guide](docs/PLUGIN_GUIDE.md).

External plugins load from `upgrade-assistant.config.json`:

```json
{
  "targets": { "react": "19.0.0" },
  "plugins": ["upgrade-assistant-plugin-tailwind"]
}
```

## Scheduled migration PRs (CI)

Want the Renovate experience, but project-aware? Copy [`docs/ci/upgrade-assistant.yml`](docs/ci/upgrade-assistant.yml) into your repo's `.github/workflows/`: weekly it analyzes, applies the safe fixes, verifies with your typechecker and tests, and opens a PR whose description **is** the Migration Report.

## Migration Report

`analyze` produces `MIGRATION_REPORT.md` — a shareable document with summary, per-library breaking changes, affected files, risk, effort estimate, a checklist for the manual steps, and links to the official docs for every finding.

## Monorepo layout

```
packages/
  core/               engine: scanner, resolver, version checker, AST services,
                      analyzer, plan builder, migration engine, verifier,
                      report generator, plugin registry, AI boundary
  cli/                commander-based CLI (upgrade-assistant / ua)
  plugin-react/       React knowledge base + codemods
  plugin-nextjs/      Next.js knowledge base + codemods
  plugin-typescript/  TypeScript knowledge base + codemods
docs/                 architecture, plugin guide, roadmap, critical analysis
examples/             deliberately outdated demo app to try the tool on
```

Details and rationale: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Try it on the example app

```bash
npm install && npm run build
node packages/cli/bin/upgrade-assistant.js analyze \
  --dir examples/react18-next14-app \
  --offline --target react@19.0.0 --target next@16.0.0 --target typescript@5.5.4
```

## Contributing

The highest-leverage contribution is **rules**: a breaking change you hit in the wild, encoded once, saves everyone else the same afternoon. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Plugin Guide](docs/PLUGIN_GUIDE.md).

## License

[MIT](LICENSE) © 2026 won3er
