# Release verification

How a DiagramCloud revision is qualified, and the record of qualified releases. A release claim is only as strong as the receipt for its exact commit: read the CI run and the receipt, not this page's prose.

## Three separate dimensions

| Dimension | Where | Current |
|---|---|---|
| Product version (semver) | `package.json`, header badge, handshake `product_version` | 1.10.0 |
| Document schema | `schemaVersion` in `src/core/model.ts` | 1 |
| Galaxy maturity | handshake `galaxy_level` | G0 (standalone) |
| Release qualification | `release/verification-receipt.json` (`galaxy.verification-receipt/1`) | per commit, see the record below |

A passing build never implies a higher level: `BUILD_VERIFIED` is not `E2E_VERIFIED`, and nothing DiagramCloud runs on its own can be `GALAXY_QUALIFIED`.

## Commands

From a clean checkout with Node.js 22:

```sh
npm ci
npm run check       # TypeScript
npm test            # unit and contract tests (node:test)
npm run build       # generates schemas, examples, Galaxy manifests and notices, then the Vite build
npx playwright install chromium
npm run test:e2e    # Chromium browser tests against the built app (vite preview)
```

`npm run qualify` runs the same checks in order, hashes the static bundle and writes `release/verification-receipt.json`. It refuses to produce a receipt for a working tree with uncommitted changes. To record a human visual qualification, write a small JSON file (`{"reviewer":"…","result":"passed","summary":"…"}`) and run `MANUAL_REVIEW=<file> npm run qualify`: the receipt cites the file's sha256 and can then reach `MANUAL_QUALIFIED`.

CI (`.github/workflows/ci.yml`) runs typecheck, unit tests, build and Chromium tests on every push to `main` and every pull request, then records the receipt from the step outcomes and uploads the `diagramcloud-ci` artifact: the receipt, `SOURCE_COMMIT.txt`, a source-and-build tarball with `SHA256SUMS.txt`, and the Playwright report/screenshots.

## What the suites cover

- **Unit/contract** (`tests/*.test.ts`): document validation, public projection, patches and revision guards, change preview, save queue, storage recovery, story, realization lifecycle and export parity, Galaxy contracts and the receipt, Mongoku projection contract, export scene geometry (no route through a box on any sample), icons and their blobs, PPTX/deck structure and links, table and transformation authoring.
- **Browser** (`tests/e2e/*.spec.ts`, Chromium): gallery and drilldown, task workspaces, editing with undo/redo and reload, visual table/transformation/source editors, Inspector grammar, observation review and portfolio index, Galaxy snapshot → review → SVG/HTML/PPTX/PNG, deep links, public projection and escaping, two-tab conflicts, storage open/quota failures, corrupt rows, stale JSON/patch imports, offline standalone HTML, reduced motion, dark mode, laptop and phone layouts.
- **Screenshots** land in `test-results/` (release journey, viewports, editors, exports); review them, do not only read the pass count.

## Static deployment check

On the deployed URL for the exact commit: the gallery loads; TotalEnergies drills SQL quality checks → Required fields with the parent kept; Explore/Edit/Portfolio/Present open; `?project=total-project-controls&view=validation&node=mandatory` opens with the parent context; HTML/SVG/PNG/PPTX exports download; `galaxy/version-handshake.json` reports the expected `product_version` and `G0`.

## Release record

| Version | Commit | CI run | Receipt level | Deployment | Notes |
|---|---|---|---|---|---|
| 1.10.0 | head of the manual PR (`feat/technical-manual`) | linked from the PR | E2E_VERIFIED (automated) | Vercel production from `main` | Technical Manual preset; Chromium only |
| 1.9.0 | `f853467` (tag `v1.9.0`) | 37543927209 | E2E_VERIFIED (automated) | Vercel production from `main` | MosaicStudio concept export; Chromium only |
| 1.8.0 | `074f307` (tag `v1.8.0`) | 37542475496 | E2E_VERIFIED (automated) | Vercel production from `main` | galaxy map, Contoso Forecasting atlas; Chromium only |
| 1.7.0 | `fab0cf8` (tag `v1.7.0`) | 37540112120 | E2E_VERIFIED (automated) | Vercel production from `main` | blueprint and editorial renderings; Chromium only |
| 1.6.0 | `29bf3f0` (tag `v1.6.0`) | 37538747043 | E2E_VERIFIED (automated) | Vercel production from `main` | perspectives, view spec; Chromium only |
| 1.5.0 | `03953be` (tag `v1.5.0`) | 37537385507 | E2E_VERIFIED (automated) | Vercel production from `main` | project atlas, multi-repository snapshots; Chromium only |
| 1.4.0 | `ed33556` (tag `v1.4.0`) | 37479911375 | E2E_VERIFIED (automated) | Vercel production from `main` | AtlasNote cheatsheet export; Chromium only |
| 1.3.0 | `2c4e989` (tag `v1.3.0`) | 37477211863 | E2E_VERIFIED (automated) | Vercel production from `main` | repository scanner; Chromium only |
| 1.2.0 | `4635d1d` (tag `v1.2.0`) | 37473334829 | E2E_VERIFIED (automated) | Vercel production from `main` | Visio import, draw.io export; Chromium only |
| 1.1.1 | `a84824c` (tag `v1.1.1`) | 37384387812 | E2E_VERIFIED (automated) | Vercel production from `main` | DataPass planning maps listed under Portfolio, not as cloud references |
| 1.1.0 | `ca31b68` (tag `v1.1.0`), qualified at `f553e0f` | 37382412074 | E2E_VERIFIED (automated) | Vercel production from `main` | draw.io and Mermaid import, cloud gallery; Chromium only |
| 1.0.0 | `4a2e5be` (tag `v1.0.0`), qualified at `7943f5b` | 37369437999 | E2E_VERIFIED | Vercel production from `main` | first V1 release |

## Cross-app checks

One contract at a time, against the owner's own reader. This is not a Galaxy qualification level.

| Date | DiagramCloud | Contract | Owner reader | Command | Result |
|---|---|---|---|---|---|
| 2026-10-07 | 1.9.0 branch `feat/contracts` | `datapass.concept-spec/1` (spec 1.0.0) | MosaicStudio standalone concept viewer, studio-v0.8.1 `8b22d9c`, sha256 `7565fb29…b6a` (copy vendored by contoso-data-studio `61353848`) | `npx tsx scripts/qualify-concept.ts <concept-viewer.html>` | 3/3 views loaded `ok`, 0 warnings, 0 network requests (contoso-forecasting overview and fabric-target, total-project-controls overview) |
