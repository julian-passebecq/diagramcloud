# Project Atlas brief: qualification record

Status of the "Multi-repo project atlas / blueprint / hop pass" brief, released as DiagramCloud 1.5.0 to 1.11.0, recorded on 2026-10-07. Every row cites the code and tests that prove it. Commands run from the repository root. Chromium only.

## Releases

| Version | Commit (tag) | CI run (`validate`) | Brief sections |
|---|---|---|---|
| 1.5.0 | `03953be` (v1.5.0) | see docs/RELEASE.md | §1 multi-repo atlas, revision vectors, explicit membership |
| 1.6.0 | `29bf3f0` (v1.6.0) | 37538747043 | §2 hop navigation, §3 perspectives, §5 ViewSpec |
| 1.7.0 | `fab0cf8` (v1.7.0) | 37540112120 | §4 Blueprint, §6 diagram-design as visual grammar (SeeCode rejected: docs/research/seecode-diagram-design.md) |
| 1.8.0 | `074f307` (v1.8.0) | 37542475496 | §11 Galaxy atlas (generated locally), §12 Contoso Forecasting |
| 1.9.0 | `f853467` (v1.9.0) | 37543927209 | §7 MosaicStudio adapter |
| 1.10.0 | `5667af4` (v1.10.0) | 37545174738 | §13 Technical Manual |
| 1.11.0 | `73da4d9` (v1.11.0) | 37546640948 | §8 Lens Git projections; §10 Brain recorded as absent |

## Qualification items

| Item | Evidence |
|---|---|
| Same entity across perspectives | `tests/viewspec.test.ts` (shop.system in System and CI/CD, explicit partial / unknown / unsupported); `tests/contoso.test.ts` (forecast-ui and gold in System and Cloud); `tests/e2e/perspectives.spec.ts` |
| Hop navigation with the parent kept, Back/Forward | `tests/e2e/perspectives.spec.ts`, `tests/e2e/atlas.spec.ts` (atlas root stays visible under a repository) |
| Deterministic rescans | `tests/atlas.test.ts` (same input, same document; rescan replaces only one repository's subtree) |
| Revision vectors, never one project SHA | `tests/atlas.test.ts`; title blocks in `tests/styled.test.ts`; manual cover in `tests/manual.test.ts` |
| Stale detection | `tests/atlas.test.ts` (age, missing folder, unknown revision, moved source; Lens heads) |
| Membership only from a manifest or a reviewed edit | `tests/atlas.test.ts` (manifest, DataPass project file, galaxy map, Add repository; Lens never adds) |
| Light and dark, narrow screens, reload | `tests/e2e/blueprint.spec.ts` (dark, 390 px, reload), `tests/e2e/manual.spec.ts` (390 px), `tests/e2e/atlas.spec.ts` (reload) |
| Offline HTML, no hidden network calls | `tests/manual.test.ts`, `tests/e2e/manual.spec.ts` (every non-file request aborted, none attempted); `tests/styled.test.ts`; `scripts/qualify-concept.ts` (0 requests) |
| Public redaction | `tests/viewspec.test.ts`, `tests/concept.test.ts`, `tests/manual.test.ts`, `tests/atlas.test.ts` (runtime pointers and private repositories never public) |
| Planned / observed / presented kept apart | `src/core/atlas/lens.ts` (Lens facts are runtime pointers only), `tests/contoso.test.ts` (reported latency is a source-derived note, no observation) |
| Cross-app: MosaicStudio | owner validator in unit and browser tests; viewer check recorded in docs/RELEASE.md "Cross-app checks" (3/3) |

## Commands

```
npx tsc --noEmit
npm test
npm run build
npx playwright test
npx tsx scripts/qualify-concept.ts <path to MosaicStudio concept-viewer.html>
npm run atlas -- <galaxy.json | project.manifest.json> --out <file>
```

## Not done, on purpose

- No commit graph, churn or "lines changed" views: Lens leaves them out, and lines changed are not productivity.
- No Brain integration: no Brain format exists on disk. `contextRefs` in a snapshot is the slot; DiagramCloud does not need Brain.
- The real Galaxy atlas holds private repository names: generate it locally with `npm run atlas`, never commit it.
- `datapass.lens.minimap/1` is read from an unmerged tern-vscode branch (`15a425b`). Re-check the reader when Lens merges.
- This is not a Galaxy qualification level. DiagramCloud stays at G0 (`public/galaxy/version-handshake.json`).

## Follow-up for the galaxy map (owned by Claude Control, not edited here)

- `datapass.concept-spec/1`: add `diagramcloud` as a producer (MosaicStudio concept export, 1.9.0).
- `galaxy.json` itself: `diagramcloud` reads it as a project manifest (1.8.0).
- `datapass.lens.minimap/1`: not registered yet; `diagramcloud` is a consumer (1.11.0).
