# Architecture

Upgrade Assistant is a **migration platform**: a deterministic engine that turns *(your project's AST) × (a curated breaking-change knowledge base)* into an impact report, a plan, and safe automated edits. Version upgrades are the first migration type; the plugin contract is general enough for tool swaps (ESLint→Biome, Jest→Vitest) later.

## The core loop

```
                ┌───────────────────────────── core (deterministic) ─────────────────────────────┐
                │                                                                                │
 project dir ──▶ ProjectScanner ──▶ PluginRegistry.detectAll ──▶ VersionChecker ──▶ UsageAnalyzer │──▶ PlanBuilder ──▶ AnalysisResult
                │   (fs walk,          (which plugins            (npm registry,      (rule slice  │      (risk,          │
                │    package.json)      apply here?)              semver diff)        × AST)      │       estimates)     │
                └────────────────────────────────────────────────────────────────────────────────┘                      │
                                                                                                                        ▼
                        ReportGenerator ◀── AnalysisStore ◀──────────────────────────────┬──────────────── MigrationEngine
                        (MIGRATION_REPORT.md,    (.upgrade-assistant/analysis.json)      │                  (AST autofixes,
                         --json)                                                         │                   package.json bumps)
                                                                                         ▼                        │
                                                                                   Explainer (AI, optional)       ▼
                                                                                   prose only, never code    Verifier (tsc --noEmit)
```

Every arrow left of `Explainer` is deterministic: same input, same output, no network beyond the npm registry, no AI.

## Modules (packages/core/src)

| Module | Responsibility | Key decision |
|---|---|---|
| `scanner/` | Discover package.json, tsconfig, source & config files | Works **without node_modules** — analysis must run on a fresh clone. Installed versions refine results when present. |
| `registry/` | npm registry port + client | `RegistryPort` interface (2 methods) makes offline mode and tests trivial. Uses the abbreviated packument (10× smaller). Failures degrade to warnings, never crash analysis. |
| `versions/` | Detected usage → `UpgradeCandidate` | Pinned `--target` works even with the registry unreachable (air-gapped CI). |
| `ast/` | Owns the ts-morph project + helpers plugins use | Files added explicitly (never from tsconfig `include`), node_modules never parsed. Helpers re-export the ts-morph surface so plugins don't depend on ts-morph directly — one AST version across the ecosystem. |
| `analysis/` | `Analyzer` orchestrates; `UsageAnalyzer` runs rules | **Rule slicing**: a rule runs only if its `introducedIn` ∈ (current, target]. React 17→18 never evaluates React 19 rules. `textHints` pre-filters files before AST walks. |
| `planning/` | Findings → ordered `PlanStep`s + risk + estimate | Risk reflects *your exposure* (match counts, fix kinds), not changelog size. The estimate heuristic is documented in code — honest orders of magnitude, not fake precision. |
| `migration/` | `MigrationEngine` applies fixes; `Verifier` typechecks | Only AST edits and structured JSON edits. Official codemods are *recommended*, never executed implicitly. JSONC configs are refused rather than corrupted (fix downgrades to manual). |
| `git/` | Safety rails | Untracked files and our own artifacts never block a migration; modified tracked files always do. |
| `report/` | Markdown + JSON output | The report is a *shareable team artifact*, structured: Summary, Libraries, Breaking Changes, Files, Risk, Time, Checklist, Official links. |
| `plugins/` | Registry + validation | **Grounding enforced at registration**: a rule without official sources throws. Rule ids must be namespaced (`react/…`). |
| `ai/` | `AiProvider` port, Anthropic impl, `Explainer` | See "The AI boundary" below. |

## The plugin contract

A plugin is data + two pure functions per rule. No side effects, no network, no AI — which is why rules are testable with an in-memory AST in ~5 lines.

```ts
interface MigrationPlugin {
  name: string;                 // 'react'
  packageName: string;          // drives version detection
  relatedPackages?: string[];   // upgraded in lockstep (react-dom, @types/react)
  detect(project): DetectedUsage | null;
  rules: BreakingChangeRule[];
}

// Two rule shapes, one discriminated union:
interface SourceRule  { scope: 'source';  detect(file, ctx): RuleMatch[]; applyFix?(file, ctx): number }
interface ProjectRule { scope: 'project'; detect(ctx): RuleMatch[];       applyFix?(ctx): number }

// Shared, declarative part of every rule:
{
  id: 'react/dom-render-removed',
  introducedIn: '19.0.0',                  // semver slicing
  severity: 'breaking' | 'warning' | 'info',
  fix: 'autofix' | 'official-codemod' | 'manual',
  sources: [{ title, url }, ...],          // NON-EMPTY — enforced by type AND at runtime
  officialCodemod?: 'npx codemod@latest react/19/migration-recipe',
  textHints?: ['render('],                 // perf pre-filter
}
```

Design rationale:

- **Rules look like ESLint rules on purpose.** ESLint proved that a community will maintain thousands of small detector/fixer pairs if the contract is small and testable. That is the answer to this project's biggest risk: knowledge-base curation cost.
- **`fix` is a spectrum, not a boolean.** The engine autofixes only what is mechanically safe; official codemods are first-class citizens (we recommend Vercel's/React's own tools instead of badly reimplementing them); everything judgment-based goes to a checklist with context.
- **Match-level honesty.** A rule can mark individual matches `autofixable: false` with a note (e.g. `ReactDOM.render` whose return value is used). The engine fixes the safe matches and reports the rest.

## The AI boundary

AI is used exactly where determinism cannot reach, and nowhere else:

| Task | Who does it | Why |
|---|---|---|
| What changed between versions | Knowledge base (humans citing official docs) | Changelogs are legal ground truth; inventing them is how tools lose trust |
| Where the project is affected | AST detectors | Deterministic, testable, fast |
| Editing code | AST fixers | Same |
| Explaining the analysis to a team | `Explainer` (optional) | Prose synthesis is the one genuinely non-deterministic task |

The `Explainer` prompt contains only knowledge-base facts + this project's findings and instructs the model to add nothing. Without an API key, the feature is simply absent — the tool never degrades to guessing.

## Trade-offs we accepted (and why)

1. **AST detection has false negatives** (dynamic code, re-exports through barrels, HOC indirection). Mitigation: the post-migration `Verifier` loop plus honest reporting — we never claim completeness, we surface what we can prove.
2. **Curation is a treadmill.** Each release of each supported library needs rules. Mitigation: the ESLint-shaped contract above + `official-codemod` rules that delegate maintenance to vendors.
3. **Single-package projects first.** Workspaces/monorepos multiply resolution complexity (hoisting, peer ranges); shipped later rather than badly (see ROADMAP).
4. **`fetch` does not honor HTTP proxies yet.** Corporate proxies work for npm itself but not for our direct registry calls; `--offline --target` is the workaround today, `EnvHttpProxyAgent` is on the roadmap.
5. **PR generation is out of the MVP.** Renovate already owns "open a PR"; our value is the analysis and the edits. A GitHub Action wrapping `analyze --json` + `migrate` is the roadmap path to PRs.

## Extension points

- **New migration plugin**: publish `upgrade-assistant-plugin-<name>` with a `MigrationPlugin` default export; users add it to `upgrade-assistant.config.json`. Nothing else to wire.
- **New registry** (private npm, JSR): implement `RegistryPort` (2 methods).
- **New AI provider**: implement `AiProvider` (3 members).
- **New verification step** (test runner, build): the `Verifier` is the seam.
- **Non-upgrade migrations** (ESLint→Biome): a plugin whose `detect` looks at the *source* tool and whose rules' `introducedIn` is the *target* tool's floor version. The contract already supports it; first-class ergonomics for it are on the roadmap.

## Repository layout

```
packages/core                the engine (no CLI concerns, publishable API)
packages/cli                 commander CLI; composition root lives in src/context.ts
packages/plugin-react        knowledge bases — one package per ecosystem
packages/plugin-nextjs
packages/plugin-typescript
examples/react18-next14-app  deliberately outdated fixture (drives the e2e suite)
docs/                        this file, plugin guide, roadmap, critical analysis
```

Dependency direction is strictly `cli → plugins → core`. Plugins never import each other. The CLI owns all I/O formatting; core returns data.

## Testing strategy

- **Core**: pure-unit tests (plan builder, semver windows, JSON editing, report sections) + fake `RegistryPort`.
- **Plugins**: every rule tested against in-memory ts-morph files — detection positives, negatives, and fix output text.
- **CLI**: a hermetic e2e suite copies the example app to a temp dir and runs the real binary offline with pinned targets, asserting on found rule ids, report sections, dry-run immutability, and post-migrate file contents.
