# Development Core trial

`packages/development-core` bundles the canonical DiagramCloud model, ViewSpec,
1.22 wrapped layout, measured scene, orthogonal routes, architecture SVG and
stable-ID delta. The app and external hosts use those same source functions.
`src/development` adds the bounded runtime adapter, not another renderer.

`development-atlas/1` is validated before projection. Runtime evidence bases
remain in the Atlas and its host inspector. Diagram nodes use unspecified design
basis and idle illustration status; no runtime fact is promoted into a reviewed
or published DiagramCloud Observation. The requested view becomes the root
before public projection, so unreachable views cannot silently substitute.

Build with `npm run build --prefix packages/development-core`; package with
`npm pack` in that directory. Distribution entries are index.mjs, contracts.mjs,
browser.js and page.mjs. The portable page uses this package's own browser
bundle. Hosts must never substitute imported text for its executable code.

An Atlas contains at most 500 entities and 1,500 relations, under 2 MiB. Stable
IDs and evidence references are validated, malformed versions are refused,
and source labels are escaped by the existing renderer. This is a private
development view; authenticated remote hosting does not create a public share.

Future Bricks/isometric renderers may map repo to campus, modules to buildings,
files to blocks, dependencies to bridges, worktrees to variants, changed files
to highlights and CI to overlays. They must consume factual contracts first;
spatial placement must never invent a second source of repository truth.

