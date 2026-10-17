# DiagramCloud Viewer (VS Code / Cursor)

A standalone, read-only viewer for one DiagramCloud JSON document. It renders the document's public projection
(`publicDocument`) with the shared DiagramCloud canvas: private components, sources, notes and workspaces never reach
the webview. Nothing is written back to the file, applied, published or sent over a network (the webview policy sets
`connect-src 'none'`).

## Use

- **DiagramCloud: Open in DiagramCloud viewer** opens the active JSON editor, or a file you choose.
- Click a card or a selection button: the request goes to the extension, which checks the exact project and document
  revision before the viewer shows the new selection.
- **Return selected context to host** sends the selected context as a one-time `diagramcloud.host-return/1` intent.
  **Download return file** saves the same intent as JSON; **DiagramCloud: Load viewer return file** reads one back.
- Closing the panel ends the session. Opening the file again starts a new session: returns and files from the earlier
  session, intents made for another revision and any intent received twice are refused, with the reason in the
  "DiagramCloud viewer" output channel.
- A refused return is never lost or altered: the viewer shows why, and **Download return file** in that notice saves
  the refused intent unchanged where you choose (the host refuses that file again for the same reason; take it to the
  host or session it belongs to). A `source` return has no route in this host and is refused as `unsupported-route`;
  source requests from the viewer are logged and never opened automatically.

## Capabilities

`diagramcloud.viewer.grants` (default `[]`, read-only). `query` lets the viewer hand the host the selected public
context request (`diagramcloud.selected-context/1`); `render` hands it the public SVG of the selected view. Both open
as untitled, unsaved documents. `propose`, `validate`, `apply` and `publish` are recognised and always refused by this
viewer: proposals go through the DiagramCloud Studio import review or the CLI, and only a person applies or publishes.

## Status

Built from source with `npx tsx scripts/package-vsix.ts` (the package records its source commit). This source package
is checked by unit tests (manifest, contents, policy, no network, no fonts). Installation and the session journey in an
installed VS Code are proven locally by `npm run test:host:vscode` (isolated profile, see `docs/contracts/react-viewer.md`), and in
the locally installed Cursor by `DIAGRAMCLOUD_HOST=cursor npm run test:host:vscode` (same VSIX, installed with Cursor's
own CLI into an isolated profile). Neither host run is part of CI: it needs a desktop session and a host download or
installation. No Marketplace or Open VSX publication, signing, update or rollback is claimed.
