# Isolated local Mosaic host

The Studio's **Mosaic preview** button prepares the selected view with an explicit public or private author audience. It downloads the ConceptSpec, full typed mapping report and derived packet. Preparing or connecting never changes the Project, source visibility, observations or permissions.

Use an existing Mosaic owner viewer, explicitly selected by filename and SHA-256. The helper does not install or fetch one:

```sh
npm run concept:host -- document.json --view root --audience public --viewer concept-viewer.html --viewer-sha256 <owner-sha256> --packet project.root.packet.json --diagramcloud-origin http://127.0.0.1:4173
```

The input document grants no access by itself: the caller must already be authorized to read it. The audience is mandatory. When a packet is provided, the helper checks its exact envelope, project/revision/view/audience, ISO generation timestamp and digest, then regenerates its entire content from the authorized input. A supplied packet is never the source of architecture facts or permissions. Packets predating the generation timestamp must be regenerated.

The helper prints `http://localhost:<port>/`. Paste that URL into the Studio's local-host field and connect. The Studio opens the helper explicitly; it sends no document through the connection. The helper's greeting must match the Studio's current packet. Returns require one current source ID and the bound origin and window. Changing the Project/view/audience invalidates the return path. Merged mappings remain inspectable but cannot navigate ambiguously.

## Existing owner API

The helper uses the existing `datapass.concept-spec/load` and `datapass.concept-spec/ready` protocol, serializing loads within one fixed projection. Modes are layered, isometric and 3D, with fit/theme options. A successful load acknowledgment is not a WebGL or completeness certificate.

The selected Mosaic 0.11.1 artifact has SHA-256 `62b451fd3e98a5303b88cca407be1eeff6f05c1c78eb166188df6bff0ac7670c`, with source provenance `f42c8a9689bf8499133c9bda1a8c58c520fe4c13`. It does not emit pick messages. Its selection stays in the viewer. The helper offers separate, labelled source-mapping return buttons; these do not claim native viewer picking. Owner support for correlated picks and automatic context-loss restoration remains a separate adoption task.

## Trust boundary

- The main Studio CSP is unchanged. The helper is a separate, explicitly started loopback process; it does not embed a remote service in the Studio.
- The helper parent is `localhost`; the viewer frame is `127.0.0.1` on the same ephemeral port. These are distinct origins. `allow-scripts allow-same-origin` is restricted to that separate viewer origin, which cannot remove its sandbox through the parent DOM or read the Studio's IndexedDB/session state.
- Only fixed GET routes exist. Host headers are checked; no arbitrary filesystem paths, write routes, CORS, credentials, T3 sessions or shell actions are exposed.
- Both explicit loopback addresses, `127.0.0.1` and `::1`, serve the same fixed routes. Startup fails if either binding is unavailable; the helper never falls back to an all-interface listener. This keeps the advertised `localhost` URL usable with either DNS address order.
- Parent and viewer use restrictive response CSPs. The viewer executable must match the selected hash and its owner-declared inline-script hash; network access is denied. The helper delivers no fonts. The existing owner HTML stays outside source and delivery archives.
- New outgoing messages use exact target origins. Incoming ready messages require the exact viewer origin and window. The owner artifact's historical ready implementation uses a wildcard internally; the host never treats that as a trust grant.
- A return origin must be explicitly granted by `--diagramcloud-origin`; a query parameter alone grants nothing. An unauthorized opener gets no greeting or mapping return.
- JSON embedded in helper scripts escapes HTML script boundaries separately. Labels and mapping rows use text content. Imported Project code is displayed, never executed.

3D needs WebGL2. If unavailable, choose either SVG mode. The selected artifact was tested for actual WebGL, reduced motion, disposal and a manual SVG return after forced context loss. Automatic restoration remains unqualified. No T3 process is required for reading, editing, saving or exporting the Project.

## Agent interfaces

The existing public MCP tool supports `diagramcloud_render` with `{ "kind": "concept", "viewId": "root" }`, returning the public ConceptSpec and mapping. It accepts no author-audience option and performs no network, file collection, launch or publication. MCP reports the package source version. Bundled Node clients include `concept-preview.mjs` and `concept-host.mjs`; starting the latter still requires explicit local input/viewer selection and audience.

## Libraries, hosts and optional SDK tooling

Keep three interfaces distinct when integrating DiagramCloud:

| Interface | Responsibility and present limit |
|---|---|
| Viewer library / SDK | Render an authorized projection using the existing viewer. The selected Mosaic standalone artifact supports load/ready; it supplies no native pick emitter. |
| Authoring core | Validate the canonical Project, propose revision-bound changes and let the host review/apply them. The CLI and static MCP session do not control an open Studio's IndexedDB. |
| Remote API client SDK | A client for a separately hosted, versioned service, with its own authentication, permissions and deployment contract. No such service is created by the local helper or stdio MCP. |

Forge remains optional tooling to evaluate for an API SDK. It is not a required renderer, layout engine, analyzer or cloud service for this workflow. The `cf` Cloudflare tool is a separate tool, not a DiagramCloud runtime dependency. The standalone source, local preview and bundled clients run without Forge or a Cloudflare account. A generated client never grants apply, shell or publication authority.
