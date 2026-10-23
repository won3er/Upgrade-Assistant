# Roadmap

Direction: from *upgrade assistant* to *migration platform*. Every phase must pass the same filter — does this solve a pain Renovate/Dependabot/codemod runners leave open, or is it complexity?

## Phase 1 — Trust (current)

- [x] Impact-scoped analysis (breaking changes × your AST)
- [x] Migration plan with per-project risk and effort estimates
- [x] Safe `migrate`: clean-tree gate, dedicated branch, dry-run diffs, confirmation, typecheck verification
- [x] `MIGRATION_REPORT.md` + `--json` for CI
- [x] React 18→19, Next 14/15→16, TypeScript 4→5 knowledge bases
- [x] Plugin contract + external plugin loading
- [x] `--only <rule-id>` / `--skip <rule-id>` granularity on analyze/plan/migrate
- [ ] Windows path hardening + CRLF-safe fixture tests

## Phase 2 — Verification depth

- [x] `verify` as a standalone command (typecheck + `--tests` runs the project's own suite, package-manager aware)
- [ ] Build-step verification (framework-aware `build` script run)
- [ ] Post-migrate diff summary grouped by rule, with per-rule revert (`ua revert react/use-ref-requires-argument`)
- [ ] HTTP(S) proxy support for registry calls (`EnvHttpProxyAgent`)

## Phase 3 — Reach

- [ ] Workspaces/monorepo support (per-package analysis, hoisting-aware resolution)
- [ ] Lockfile-aware current-version resolution (npm, pnpm, yarn, bun)
- [x] GitHub Action template (`docs/ci/upgrade-assistant.yml`): scheduled analyze → migrate → verify → PR with the report as description
- [ ] Published reusable Action (`uses: upgrade-assistant/action@v1`) with inline PR annotations
- [ ] Plugin scaffolder: `upgrade-assistant plugins create <name>`

## Phase 4 — Platform

- [ ] Non-upgrade migrations as first-class flows: ESLint→Biome, Jest→Vitest, styled-components→CSS modules, Prisma→Drizzle
- [ ] Community rule registry with source-verification CI (a rule PR fails if its cited URLs die)
- [ ] codemod.com interop: surface registry codemods as `official-codemod` steps automatically
- [ ] More knowledge bases: Vue, Angular, NestJS, Prisma, Tailwind, Vite, Astro, Svelte, Node.js LTS jumps
- [ ] Changelog-diff assistant: when a NEW major ships, draft candidate rules from the official upgrade guide for human review (AI drafts, humans verify, sources required — the grounding invariant is non-negotiable)

## Explicit non-goals

- **Replacing Renovate/Dependabot** for routine minor/patch bumps — they are good at that; we integrate, not compete.
- **Fully autonomous migrations.** The checklist is a feature: judgment calls belong to humans.
- **AI-generated code edits.** Every automated edit stays deterministic and reviewable.
