# Critical Analysis

Written before the first line of code (July 2026), kept as a living document. If a decision below stops being true, change the code or change this file — not neither.

## 1. The honest verdict on the idea

"Smart dependency updater" is a crowded, losing frame. The valuable, unowned capability is **impact-scoped migration analysis**: crossing the delta between two versions of a library with *how this specific codebase uses it*, producing "React 19 has 12 breaking changes, but only 3 affect you, in these 4 files, 2 auto-fixable, ~46 minutes."

Version bots (Renovate, Dependabot) stop at `package.json`. Codemod platforms (codemod.com, jscodeshift ecosystems) start at the transform. The middle — *what breaks in MY project and what's the plan* — is the product. Everything else here (version checks, codemod running) is commodity and treated as such.

## 2. The biggest risk is not technical

It is **curation cost**: keeping breaking-change knowledge current for every supported library, forever. This killed or commoditized several predecessors; it is why codemod.com pivoted to a community registry.

Mitigations baked into the architecture:

- Rules are **small declarative objects** (data + detect + optional fix), deliberately shaped like ESLint rules — the one contract proven to attract thousands of community contributions.
- **Official codemods are first-class** (`fix: 'official-codemod'`): where vendors maintain the transform, we point at it instead of duplicating maintenance.
- The plugin registry **rejects rules without official sources**, keeping the knowledge base reviewable ("is this URL real and does it say that?") rather than trust-me.

## 3. Technical limitations we accept and surface

1. **Static analysis misses dynamic usage** (string-keyed access, barrel re-exports, HOC indirection). Answer: post-migration verification loop (typecheck now, tests on the roadmap) + never claiming completeness.
2. **Codemods on arbitrary codebases are hard.** Answer: autofix only mechanically-safe transforms; per-match honesty (`autofixable: false` + note) for ambiguous occurrences; wrong-edit bugs treated as P0.
3. **Monorepos/lockfiles/peer-dep solving** are real complexity. Answer: explicitly out of MVP; roadmap Phase 3, done properly or not at all.
4. **LLMs hallucinate migrations.** Answer: AI is architecturally fenced to prose (`--explain`); the deterministic pipeline never consults it.

## 4. Competitive landscape (July 2026)

| Tool | What it does well | The gap it leaves |
|---|---|---|
| Renovate / Dependabot | Version PRs at scale; merge-confidence signals; Dependabot now hands failing alerts to AI agents | No project understanding; remediation is *reactive* (after CI breaks) |
| npm-check-updates / taze | Fast "what's newer" | Nothing else |
| codemod.com | CLI + community registry + workflow engine (jscodeshift/ast-grep/ts-morph) | Transform-centric: doesn't answer "what breaks in my project?", no impact/risk/effort analysis |
| OpenRewrite / Moderne | Mass refactoring, strong in Java | JS/TS support gated behind the commercial platform |
| GitHub Copilot modernization / Amazon Q Transform | Validate the assess→upgrade→verify concept | .NET/Java focus, proprietary, cloud-bound |
| nx migrate | Migrations as first-class workflow | Nx-workspace-only |

Positioning: **local-first, open-source, deterministic, JS/TS-native impact analysis** — integrating with (not competing against) both the version bots upstream and official codemods downstream.

## 5. Decisions that changed the original brief

1. **Migration Platform framing** (per the author's own suggestion): the plugin contract is migration-generic; upgrades are the first migration type.
2. **PR generation cut from MVP**: requires forge auth, duplicates Renovate's strength, adds no analysis value. Path back: GitHub Action wrapping `analyze --json` + `migrate` (Phase 3).
3. **"React 19 → 20" example replaced with real migrations** (React 18→19, Next 14/15→16, TS 4→5): React 20 does not exist; a trust-first tool cannot demo on fiction.
4. **`--offline --target` mode added**: analysis works air-gapped; also makes the e2e suite hermetic.
5. **Grounding enforced structurally** (non-empty `sources` tuple + registration-time validation), not as a guideline.
6. **Untracked files don't block `migrate`** — only modified tracked files do; the tool's own artifacts never gate the tool.

## 6. What "success" must look like

A developer runs `analyze` on a real project and, within a minute, knows more about their upgrade than an afternoon of changelog reading would give them — with every claim linked to official docs. If any release of this tool ever trades that trust for autonomy or coverage theater, it has failed its purpose.
