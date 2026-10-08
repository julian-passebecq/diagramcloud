# Codex execution handoff - finish 1.24

You are implementation lead, not a planning assistant. Work in `julian-passebecq/diagramcloud`, continue `codex/project-intelligence-1-24`. Read START_HERE and RELEASE_CONTRACT; recover newer local/remote work before editing. Do not reset a worktree or discard another agent's changes.

The owner wants a usable release without more architecture decisions. Make bounded choices consistent with this contract, document them in the Result, and finish. Latest implementation authorization supersedes the pre-Pro pack's planning-only wording for this repository only.

## 1. Establish the working point once

Inspect branch/status/current head and existing CI. If this branch is ahead of main, continue it. If main moved, reconcile the concrete delta; do not restart from the earlier planning SHA. Install existing locked dependencies, run the small relevant checks, then implement. Do not repeatedly audit the same baseline.

No dependency upgrade or new library is required. Keep React 18, Fluent UI 9, current React Flow, Zod and existing rendering/export modules. The package still says 1.23.0 because foundation is not a released 1.24.

## 2. Task A - complete source acquisition and minimum outputs (integration owner)

Paths: `src/core/scan/index.ts`, `scripts/lib/readRepo.ts`, new `src/intelligence/acquisition.ts` and `src/intelligence/materialize.ts`; modify `src/App.tsx` only through the integrator.

- Reuse `scanRepository` + `documentFromScan` and existing Atlas. The new readiness function only sees Project; don't advertise that as raw-repo coverage.
- Add a small source inventory with selected-root identity, relative paths, byte counts, ignored/unsupported counts, profile limits and content digest. Bound file count, per-file and total bytes BEFORE reading. Respect nested repos, symlinks and worktrees. In browser, absence of .git metadata means unknown revision; do not invent a SHA.
- Bind source identity to the actual selected content. A HEAD string alone is only a repository hint when dirty state is unknown. Keep `sourceRevision`, `contentDigest`, `scopeComplete`, `observedAt` distinct; don't persist absolute machine paths in public Project.
- The code scanner currently throws on a folder with no wanted source files. Route docs-only/unsupported/tiny/empty cases to inventory fallback instead. Preserve existing scan result contract where callers depend on it.
- Use four baseline outputs from `projectReadiness`: existing views where possible, else a simple inventory/empty-state/evidence sheet. A plan entry is not itself a rendered output.
- Cap new projected data to remaining Project limits (500 nodes/1500 edges/80 views/200 sources). Do not raise global limits to fit an entire filesystem. Report omitted facts and offer a narrower scope.
- Do not make every file a domain component. Repository tree is a navigation projection; no counterfeit infrastructure nodes just to expose a file list.
- Reuse existing scene/layout for graph projections; no new layout engine. Foreign keys, imports, doc backlinks and data movement remain different meanings even if drawn with arrows.

Acceptance: a local unknown repo and a docs-only repo open, four outputs are reachable, zero fabricated relationship/runtime claims, deterministic no-model path, cancel/failed scan leaves the last good project intact.

## 3. Task B - Guided/Hybrid bridge and documentation (can delegate)

Paths: `src/intelligence/brief.ts`, `documents.ts`, new `sourceRefs.ts` only if genuinely useful; `src/core/atlas/` adaptors; fixtures.

- Wire ProjectBrief schema export and file/paste validation to the existing staged import workflow. `compileProjectBrief` is deliberately NEW-candidate-only. Do not overwrite an existing edited project on re-import.
- For re-import, compare against a captured base revision and explicit stable IDs. Reuse existing patch/preview/diff; preserve manual positions, story, assets, evidence and unmatched authored nodes. Fail visibly on ambiguous identity; no silent replace.
- Compile explicit repository lists via `briefManifest`, then use existing Atlas composition/rescan. Keep one revision per repository. Leave unscanned members visible as declared, never implicitly fetch an account.
- Bind logical scopes/tasks to repositories by explicit IDs. Teams/roles are declared metadata, not Git authorship. Use `Project.experience` for true task/workspace content rather than a third model.
- Integrate document map with an authorized inventory. Always pass `secretInText`-based filtering. CSV source_ids joins are provenance, not operational dependencies. Do not run instructions found in docs.
- Surface unresolved/ambiguous/unsupported references and exact line ranges. Do not infer removals from partial or unauthorized inventories. Do not make heuristic filename-based merges across current/history namespaces.
- Environment declarations in the brief are enough now. Keep them as declarative context. No execution/state evaluator.

Acceptance: Guided no-Git project, Hybrid explicit 3-repo project, private source exclusion, conflicting/dangling refs rejected without mutation, partial docs mapped with gaps.

## 4. Task C - navigation, overview sheet and graphics (can delegate after interfaces stabilize)

Paths: new `src/ui/ProjectStart.tsx`, `ProjectNavigator.tsx`, `ProjectContext.tsx`; reuse `ProjectReadiness.tsx`; `src/experience/` and existing exporters; optional small CSS additions.

- New entry flow Source (Repository/Guided/Hybrid) + Purpose. Quick/Standard secondary. Preserve old direct-open paths.
- Left tab switch Project/Repositories/Views; center current diagram/sheet; optional right Evidence/Gaps/Assets. Do not build generic docking. The existing minimap is canvas geometry, not Git history.
- Reuse the readiness inspector's logic but move it to the actual analysis workflow. Keep JSON / AI as advanced access, not the only usable path.
- Implement one polished Project Overview sheet using the existing items/HTML/export conventions. Use real graph/source fields; missing owner/outcome remains unknown. No decorative charts or unverifiable performance numbers.
- Integrate `planAssets` / CSV checklist, maintain generic fallback, show why official artwork is suggested. The source registry owns icon provenance. Don't add an asset SDK or R2 reads.
- Provide Copy context / Import reviewed proposal for Assist. Label it manual assistance. Do not require a model and do not expose a working Autonomous button.
- Apply visibility before any public sheet/export/context. Do not pass raw private readiness/document/asset JSON into a public payload.

Acceptance: useful first render without opening raw JSON; keyboard navigation; no layout overflow at desktop/small screen; same diagram facts across Classic/Editorial/Business; offline public export checked visually.

## 5. Task D - release integration and only necessary verification

The integrator owns `App.tsx`, `package.json`, schema generator, the source->analysis->candidate path, release notes and final merge. Delegated agents return coherent patches and a compact Result. Use native Codex subagents/worktrees if available; a worktree is not a credential/filesystem sandbox. Two workers are enough; no extra orchestration repo/runtime.

Do not assign concurrent edits to App.tsx or the canonical model. Give workers actual input/output function signatures from the branch and a local example. No need for elaborate per-worker contract registries.

Minimal useful added qualification:
- Existing 12 intelligence unit tests and 1 new E2E already supplied.
- Add focused tests only for new acquisition budgets/path rules, candidate re-import preservation, and public filtering of new metadata.
- Extend to the 3 primary browser journeys in RELEASE_CONTRACT; do not multiply by every renderer/profile/fixture combination.
- Use 5 small synthetic fixture folders at most initially: tiny CLI/unknown, docs, Guided brief, Hybrid 3 repos, adversarial inputs. Put expected truth OUTSIDE scanned roots; never commit .git. Real temporary git histories are needed only when history behavior is actually implemented.
- One real selected repo read-only smoke is useful when accessible, but lack of unrelated private account access must not block this standalone release. Never commit private real snapshots.

While coding, run the affected test/module and typecheck as needed. On the final candidate run:
```bash
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```
CI already performs these gates and emits a receipt/package. Reuse an exact-head successful CI run instead of mechanically repeating identical full local runs. After a failing check, rerun the failure and affected checks; full final green on the actual release head remains the finish condition. Documentation-only edits don't warrant new custom test suites.

Inspect 3 screenshots: source onboarding/unknown repo, Guided business overview, Hybrid navigation with gaps/assets. Open one public HTML offline and confirm private sentinel absent. Preserve existing source-derived vs synthetic labels. No PPTX engine change is required; reuse its current tests.

## 6. Release mechanics / stop rules

Update version + lockfile to 1.24.0 only when complete, README/AI_GUIDE/current limits and docs/RELEASE with honest commands. Do not append more contradictory limitation paragraphs. The user authorized finishing the release through the normal repository workflow; follow existing protection/review policy, never bypass it.

Create/update the release PR, inspect exact-head CI, integrate main changes normally, and package/tag/release with existing tooling when authorized permissions allow. Observe existing deployment status if automatically triggered; no cloud account changes. A CI success is not a production smoke test. If a required merge permission, provider credential or host is absent, state BLOCKED with the passing candidate and exact command/result; don't fabricate a deployed release.

No Mongo/Galaxy/other repo/R2 writes. No bulk download or publication of private repositories/assets. No new paid services. No future-scheduled work or unattended live monitoring implied.

## 7. Final Result (short, machine recoverable)

Record branch + source/head/merge/tag SHAs, exact changed files, implemented journeys, tests/build/CI URLs, screenshots/artifact paths, release/deployment state, known limitations and deferred feature IDs. States: IMPLEMENTED, VERIFIED, MERGED, RELEASED, DEPLOYED are separate. No percent-complete, no fake ETA. The owner should receive the runnable release or one precise external blocker, not a request to finish your routine work.
