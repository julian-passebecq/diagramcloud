# DiagramCloud 1.28.1: host proof, ports, tour controls, packaging report

A patch on top of [1.28.0](RELEASE_NOTES.md). Document schema stays 1, and no model or export format changes. V2 is still not complete: the [R4 crosswalk](../product/R4_CROSSWALK.md) and [V2_WORKSTREAM_STATUS](../product/V2_WORKSTREAM_STATUS.md) still apply.

## What changed

- **Installed VSIX in VS Code** ([#86](https://github.com/julian-passebecq/diagramcloud/pull/86)). `npm run test:host:vscode` runs `tests/host/vscode-host.test.ts`, which uses `@vscode/test-electron` (pinned exactly) and Playwright Electron. It installs the built `.vsix` with VS Code's own CLI, in a profile inside the workspace. It then checks the read-only default with no private data in the webview, selection and live return, a return file accepted once and then refused when replayed or stale, returns refused after the panel closes, the earlier session's file refused after reopening, `render` granted and `apply` refused, and uninstall. Each run writes `.local/vscode-host/<run>/receipt.json`, which is git-ignored.
- **Configurable e2e ports** ([#85](https://github.com/julian-passebecq/diagramcloud/pull/85)). `scripts/lib/e2ePorts.ts` sets the ports for the Playwright config, the fixture build scripts and the specs. `DIAGRAMCLOUD_E2E_PORT` is the base: the app uses the base, the React viewer fixture base+1, and the edge-label fixture base+2. The default is 24173-24175, so parallel lanes no longer collide on 4173. `DIAGRAMCLOUD_FIXTURE_PORT` still overrides a single fixture server.
- **Packaging report from evidence only** ([#85](https://github.com/julian-passebecq/diagramcloud/pull/85)). In the `npm run package:candidate` evidence file, each check can record an optional one-line `inspectedBy` and `method`. SHIP-REPORT lists only those, names the checks with no inspector and no longer claims any inspection by default. On Windows it uses `%SystemRoot%/System32/tar.exe` with paths relative to the workspace.
- **Tour and saved-context controls at 390x844** ([#87](https://github.com/julian-passebecq/diagramcloud/pull/87)). Keyboard focus no longer falls to the page body. For example, New tour cleared its title and so disabled the button that had focus. Focus now moves to the tour player heading, to Resume or Play, to the panel heading, or to the next Restore button. Disabled stop buttons stay focusable. `tests/e2e/tour-controls-mobile.spec.ts` drives every control by Tab and Enter or Space at 390x844 with reduced motion.

## Limits

- The VS Code host test runs only on a local desktop, because it downloads VS Code (about 335 MB). CI does not run it. Cursor, extension update and rollback, signing, Marketplace publishing and the webview's "Download return file" button are not proven.
- Packaging on Linux after the tar change is not proven.
- The mobile tour test reaches canvas cards with a programmatic focus, not a full Tab walk. The sidebar tabs and the canvas at 390 px are not covered.
- The PPTX check for #87 used a synthetic schedule and measure sample, because no shipped example has that evidence.
- Only Chromium is qualified.

## Qualification

The commands in [RELEASE.md](../RELEASE.md): `npm run check`, `npm test`, `npm run build` and `npm run test:e2e`. The integration pull request records the results for the exact head, the CI run and the sha256 of the local candidate package. This page makes no claim about a tag, a public release or a deployment.
