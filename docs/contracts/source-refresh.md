# Source refresh summary and return context

Status: implemented (P7 `source-refresh-return-context`, toward 1.34.0).
Code: `src/intelligence/refresh.ts` (`previewRepositoryRescan`, `refreshSummary`, `resolveRefreshReturn`, `NOT_ESTABLISHED`), `src/ui/SourceRefreshSummary.tsx`, `src/App.tsx` (rescan, legacy picker, review, Apply and Cancel).
Tests: `tests/intelligence-refresh.test.ts`, `tests/scan.test.ts` (legacy cancel), `tests/e2e/atlas.spec.ts` ("source refresh", 1440 and 390 px).

## What a refresh is

A refresh rescans one atlas repository from a folder the author picks (Project atlas → Rescan…, Edit mode). It produces a proposal: a whole document that goes through the ordinary JSON review. Nothing changes until the author applies it. Applying is one revision and one Undo. The proposal never makes an observation, a review or a "reviewed" mark.

## Summary (`refreshSummary(current, proposal, {repositoryId?, audience?})`)

This is a pure function of the two documents. It changes nothing and stores nothing. The scope is the repository's ID namespace (`<repo>.`, `repo-<repo>`, `repo-<repo>.facts`, `analysis-repo-<repo>-*`). If no repository is named, the scope is the repositories whose active-snapshot record differs. Items are compared by exact stable ID only. Two different IDs are never paired, and a label match is never treated as identity.

| Category | Meaning |
|---|---|
| `added` | Components, connections, views, sources and scanner evidence whose ID the current document does not have. New scanner facts arrive private. |
| `changed` | Same ID with different scanner content: a component's sources, evidence or basis; a connection's label or kind; scanner evidence (source-derived blocks, or reference blocks in the scanner namespace). |
| `uncertain` | Components that the scanner had established before and that the latest scan did not establish. They keep their ID, authored text, layout and references, and carry the tag `Not established by latest scan` with basis `unknown`. The summary never calls them removed. A component that a later scan establishes again loses the tag and returns to `static-source`. Authored (planned) components in the namespace are not scanner facts, so they are never marked uncertain. |
| `unavailable` | The repository was not scanned, failed or is missing; or it has no readable Git revision (its content is not attested by a revision); or a scope component cites a source the proposal cannot resolve. |
| `retainedEvidence` | Authored evidence (author or synthetic blocks, or a reference outside the scanner namespace) attached to a scope component, kept byte for byte. |
| `authoredNotRetained` | Authored evidence that the proposal changes or drops, for example after a hand edit of the staged JSON. It is shown so the author sees it, never hidden. |

`revision` lists `from` and `to` for each repository in scope. An unknown revision is left out; it is never invented.

**Public audience.** With `audience: 'public'`, both documents are first projected through `publicDocument`. No private label, ID or count enters the summary. The review panel itself is shown only to the author, because the import review exists in Edit mode only.

## Return context (`resolveRefreshReturn(context, live, audience)`)

When a rescan starts, the App records the project ID, the drilldown path, the active view, the selected component and the sheet. These are stable pointers only. On Apply, or on Cancel (closing the review):

- If the path prefix down to the active view is still an exact permitted `childViewId` chain in the current audience (`publicDocument` for a public audience), the App reopens that view on its sheet.
- Open levels below the active view are kept only if they are still permitted. Otherwise they are closed, and nothing replaces them.
- The component is reselected only if the view still holds that exact ID. Otherwise nothing is selected, and the message says so.
- If the view's path is revoked, the view is missing, it is private in a public audience, or the project changed, the return is refused with the generic `VIEW_ROUTE_UNAVAILABLE` message ("This navigation target is unavailable in the current permitted context."). The reader goes to the root. No other parent, view or component is chosen in its place.
- Returning never creates a revision.

## Legacy picker cancellation

"Diagram from a repository" (`scanLegacyFolder`) now registers with the App's analysis job: it gets an `AbortController`, and a newer analysis or `cancelAnalysis` aborts it. It passes `abort.signal` to `scanPickedFolder`. A cancelled scan rejects with `AbortError`, produces no candidate, and stages nothing. This lifts the 1.29 limit "the UI folder picker does not pass one yet".

## Limits

- The summary lists at most 12 items per category in the UI ("and N more"). The function returns them all.
- Uncertainty is derived from the tag that `previewRepositoryRescan` writes. A tag edited by hand changes the reading.
- The return context lasts for the session only and is never saved. Reloading during a review forgets it.
- There is no Cancel button for the legacy picker while it runs. Cancelling happens when another analysis starts or the start dialog closes, as for the other analyses.
