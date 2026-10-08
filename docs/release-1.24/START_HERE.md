# DiagramCloud 1.24 - Code Lead decision and execution entrypoint

Status: implementation foundation, not a completed 1.24 release.
Baseline: `2558758e06d48010fbaf7bdb9594d32f36900f09` (1.23.0).
Continue branch `codex/project-intelligence-1-24`; do not start a second application.

The current owner instruction authorizes implementation in **DiagramCloud**. It supersedes the earlier pre-Pro pack's planning-only restriction, but does not authorize changes to other repositories, project memory, cloud accounts or asset buckets.

Read `RELEASE_CONTRACT.md`, then `CODEX_WORK.md`. Historical planning matrices are a scope inventory, NOT a requirement to ship all 115 features at once.

## Outcome, not another architecture exercise

Deliver **1.24 Project Intelligence**: choose a Git folder, describe a project, or declare several repositories; obtain useful bounded views with honest source/unknown labels; navigate the logical project or physical repository; export a business overview and the existing diagrams. Works without an AI account, Galaxy, a server or R2.

Preserve Explore/Edit/Portfolio/Present, task workspaces, sidecar conflict guards, the current canvas, the measured export scene, official icon rules, and all existing export paths.

## Decisions already made

- Evolve the existing TypeScript/React application. No monorepo split, global event bus, graph database, plugin loader or agent runtime.
- `src/intelligence/` is the additive pure-function layer. `Project` stays the bounded authoring document; reports/maps are derived private context.
- Begin with existing scanner + selected Markdown/CSV. No universal AST, OpenAPI, .NET, Fabric or Databricks parser required for 1.24.
- Reuse the existing Atlas for multi-repository membership/revision vectors. For 1.24, cross-repo edges require explicit authored relationships. No name/provider-based automatic joins.
- One `ProjectBrief` input compiler, not another persistent source of truth. It creates a candidate; existing preview/apply is the persistence boundary.
- Four minimum **outputs**, not four compulsory graph renderers. Overview, structure, meaningful relations OR honest absence, evidence/gaps. A table or empty-state explanation can be the correct output.
- Keep at most 4-7 recommended views. No giant global graph or hundreds of per-file tabs.
- New first-use inputs: source, purpose, depth. AI Off works completely; Assist means export context/import a reviewed proposal. Autonomous is not a functioning 1.24 option.
- Asset checklist and generic fallbacks are enough for 1.24. No new R2/provider provisioning or image-generation service.
- Environment declarations are preserved now; runtime deployment, promotion, drift and detailed evolution are later capabilities. Differences are not automatically drift.
- Do not refactor the entire App before delivering a slice. Extract only handlers/components needed by this work. One integrator owns App.tsx.
- No new testing framework. Targeted checks while editing; current full CI once on the release candidate, rerun only failed/affected checks after a correction.

## Code provided on this branch

| File | Implemented behavior | Boundary |
|---|---|---|
| `src/intelligence/types.ts` | Derived report/map/asset contracts and simple options | No canonical Project migration |
| `src/intelligence/readiness.ts` | Four-output plan, explicit capability signals, contextual gaps | Inspects an existing Project, NOT raw Git or live state |
| `src/intelligence/documents.ts` | Bounded Markdown headings/file links; CSV record/source_ids links with line ranges | Selected docs only; caller supplies safety filter; no prose-to-facts claims |
| `src/intelligence/brief.ts` | Strict ProjectBrief validation and new-candidate compiler | Private declared context; manifest handed to existing Atlas; no merge overwrite |
| `src/intelligence/assets.ts` | Registry resolution, safe generic fallback, CSV checklist | No generated provider branding or network calls |
| `src/ui/ProjectReadiness.tsx` | Small inspector, contextual purpose, report/asset downloads | Temporarily inside JSON / AI; move/reuse for new entry flow |
| `src/ui/RepositoryBridge.tsx` | Adds the inspector without changing sidecar behavior | Two additive lines only |
| `scripts/intelligence.ts` | inspect / brief / docs CLI with bounded inputs and new output directory | Outputs are authoring files, never public publication |
| `examples/project-intelligence/project-brief.json` | Synthetic Guided example | Not employer/project evidence |
| `tests/intelligence*.test.ts` | Twelve focused boundary tests | Reuse node:test; no zoo framework |
| `tests/e2e/intelligence.spec.ts` | One authoring inspector/download/no-mutation journey | Reuse Playwright |

## Known implementation limits to finish, not hide

The new report currently PLANS minimum outputs; it does not render a new four-view workspace by itself. The compiler has a CLI but is not yet wired to New Project. The document mapper is not yet a repository reader. The readiness inspector is an early additive integration, not the final left/right navigation shell.

A last-known project SHA is NOT a clean-worktree content attestation. Carry inventory digests and scan completeness once the reader is integrated. A docs map from partial input must not make absence/removal claims. Generated private reports must not leak through public exports or model context.

## Validation notes

Eight browser-independent pure-function tests were executed in the code-lead workspace. They were transpiled with `tsc --noCheck` because this workspace could not clone/install network packages; this is **not** a full typecheck or application build. GitHub CI is the authoritative full integration check for the pushed branch. Record exact CI state separately; never reinterpret this paragraph as CI PASS.

## Start commands

```bash
npm ci --no-fund --no-audit
npm run check
npx tsx --test tests/intelligence.test.ts tests/intelligence-brief.test.ts
npm run intelligence -- brief --input examples/project-intelligence/project-brief.json --out /tmp/diagramcloud-brief-unique
```

Use a new output directory (CLI refuses overwriting an existing one). On Windows choose a new path under the OS temporary directory. Do not change global tool/provider configuration.
