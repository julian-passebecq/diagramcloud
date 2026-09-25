# Realization overlay contract

Date: 2026-09-25. Covers the observation model (`src/core/realization.ts`, `src/core/model.ts`), the
`diagramcloud.portfolio-index/1` export (`src/export/portfolioIndex.ts`), and the deep-link format
(`src/core/links.ts`) that other Datapass Galaxy apps use to reach a component.

## Three meanings, kept apart

Every component in the architecture graph is **Planned / designed**: its `status` (idle/running/complete/
warning/failed) is an illustrative design state, never a deployment or business-validation claim
(`src/core/realization.ts`, `MEANING`, `STATUS_NOTE`). An **observation** is a dated external fact about one
component, owned by another app at a named source revision. It becomes **Presented** only after an author
reviews it and makes it public; presenting an observation never changes who owns the fact or its claim.

## Observation contract

### Fields and limits

`observationSchema` in `src/core/model.ts`:

| Field | Type / limit | Notes |
|---|---|---|
| `id` | stable ID, `^[a-z][a-z0-9_.-]{0,79}$` | |
| `nodeId` | stable ID | must reference an existing node |
| `sourceApp` | `^[a-z][a-z0-9-]{0,39}$` | a lowercase app name, e.g. `datapass-vscode` |
| `authority` | 1-160 chars | who/what actually knows this fact |
| `observedAt` | ISO 8601 instant, offset required | |
| `sourceRevision` | 1-120 chars | commit, plan revision or similar |
| `claim` | one of the four values below | |
| `summary` | 1-500 chars | what the source saw, one sentence |
| `link` | optional; http(s) or `vscode:` link, no embedded credentials | `isOpenUri` |
| `blockIds` | up to 1000 stable IDs, default `[]` | evidence backing the claim |
| `caveat` | up to 1000 chars, default `''` | what the snapshot does not show |
| `visibility` | `private` \| `public`, default `private` | |
| `reviewedAt` | optional ISO instant | set only by the author, in-app |
| `shareable` | boolean, default `false` | |

### The four claim values

`OBSERVATION_CLAIMS` / `CLAIM_LABEL`: `observed` (Observed), `verified` (Verified), `partial` (Partly
observed), `not-observed` (Not observed). None of these implies DiagramCloud validated anything: the claim
and its authority stay the source app's statement (see the "No green" comment in `src/ui/Realization.tsx` —
`verified` never renders as a success/green colour).

### Sending one: `observationPatch()`

Another app (or an operator script, or a test) builds an observation with `observationPatch(doc, input)`
from `src/core/realization.ts`. `input` is `ObservationInput`: `id`, `nodeId`, `sourceApp`, `authority`,
`observedAt`, `sourceRevision`, `claim`, `summary`, plus optional `link`, `caveat`, `blockIds`. The function
forces `visibility: 'private'` and `shareable: false` regardless of what the caller passes — an observation
always arrives private and unreviewed. It returns a `diagramcloud.patch` envelope (`src/core/patch.ts`,
`PATCH_FORMAT = 'diagramcloud.patch'`) with a `test` operation asserting the target node still exists,
followed by an `add` at `/observations/-`.

Example (placeholder values only):

```json
{
  "format": "diagramcloud.patch",
  "version": 1,
  "target": "project",
  "targetId": "<project-id>",
  "baseRevision": 12,
  "summary": "Add a datapass-vscode observation for <node-id> (observed, revision <source-revision>)",
  "operations": [
    { "op": "test", "path": "/nodes/@<node-id>/id", "value": "<node-id>" },
    {
      "op": "add",
      "path": "/observations/-",
      "value": {
        "id": "<observation-id>",
        "nodeId": "<node-id>",
        "sourceApp": "datapass-vscode",
        "authority": "<name the system that owns this fact>",
        "observedAt": "2026-09-25T10:00:00Z",
        "sourceRevision": "<commit-or-plan-revision>",
        "claim": "observed",
        "summary": "<what the source saw, in one sentence>",
        "blockIds": [],
        "caveat": "<what this snapshot does not show>",
        "visibility": "private",
        "shareable": false
      }
    }
  ]
}
```

This patch goes through the normal revision-guarded JSON Patch path (`src/core/patch.ts`,
"Revision-guarded JSON Patch" in `docs/ARCHITECTURE.md`): it is refused if `baseRevision` is stale, if it
touches an `id` or the document's own identity fields, or if the result fails `validateDocument`. The JSON /
AI dialog's **New observation patch** button fills in this same template for the currently selected
component (`src/App.tsx`, `newObservationPatch`).

### Review lifecycle

1. **Arrives** — private, unreviewed (`reviewedAt` unset), not shareable. It shows in the Realization
   section as "Not reviewed · private" (`src/ui/Realization.tsx`, `review()`).
2. **Author reviews** — clicking **Mark reviewed** in Edit mode sets `reviewedAt` to the current time
   (`src/App.tsx`, `observationActions.onReview`). This is the only way `reviewedAt` is set; nothing in the
   codebase sets it automatically.
3. **Visibility** — the author can then set `visibility` to `public`. The visibility selector is disabled
   until `reviewedAt` is set.
4. **Shareable** — the "Shareable in portfolio index" checkbox is disabled unless the observation
   `isPresented` (`visibility === 'public' && reviewedAt` is set). Switching visibility back to `private`
   also clears `shareable` in the same update.

An observation becomes **Presented** exactly when `visibility === 'public' && reviewedAt` is set
(`isPresented()`). A story step may cite any reviewed observation about a component in its view, but the
public story (Present mode in Portfolio, standalone HTML) keeps only Presented citations. Only a Presented
observation can be marked shareable.

### What gets refused

`validateDocument` in `src/core/model.ts` runs these checks on every observation (index `i` in the
document's `observations` array):

- **Credential-like values or `.env`-looking text** — `secretFindings(o, ...)` from `src/core/secrets.ts`
  scans every string field and key name. It refuses Mongo/Postgres/MySQL/Redis/AMQP connection strings,
  GitHub/OpenAI/AWS/Slack tokens, JWT-shaped strings, PEM private keys, `key: value` pairs whose key looks
  like `password`/`token`/`secret`/`api_key`/etc. (unless the key ends in a safe suffix such as `_ref` or
  `_present`), and two or more `.env`-style `NAME=value` lines. Findings name the path and the reason, never
  the value.
- **Credential links** — `link` must pass `isOpenUri`: http(s) or `vscode:` protocol, no embedded
  username/password.
- **Synthetic evidence as backing** — an observation cannot cite a `blockIds` entry whose evidence block has
  `provenance === 'synthetic'`: "synthetic figures are never measured results."
- **Shareable without reviewed + public** — `shareable` can only be `true` when `reviewedAt` is set and
  `visibility === 'public'`. This is enforced twice: the UI disables the checkbox, and `validateDocument`
  refuses a document where it is violated some other way (e.g. a hand-edited JSON import).
- **Unknown `nodeId`** — refused like any other dangling reference.
- **Story citing an unreviewed observation** — a story step's `observationIds` must reference a reviewed
  observation about a component that is actually in that step's view.

`d.portfolio` (the portfolio-index settings block) is scanned by the same `secretFindings` check.

## Portfolio-index export contract

`diagramcloud.portfolio-index/1` (`src/export/portfolioIndex.ts`, `PORTFOLIO_INDEX_FORMAT`) is a small,
user-triggered snapshot built for Mongoku's read-only projection view. It is built from `publicDocument`
only, so private nodes, evidence, assets and the authoring document never reach it.

**DiagramCloud only exports this file.** Storing it in DATAPASSCONTROL for Mongoku to read is a separate,
operator-reviewed step outside DiagramCloud (`src/App.tsx` shows this message after the export). DiagramCloud
never connects to MongoDB and has no Mongo client code.

### Envelope fields (`portfolioIndexSchema`)

| Field | Value |
|---|---|
| `format` | literal `diagramcloud.portfolio-index/1` |
| `projectRef` | `portfolio.projectRef`, else the document ID |
| `sourceApp` | literal `diagramcloud` |
| `sourceObjectId` | the document ID |
| `sourceRevision` | the document revision, as a string |
| `generatedAt` | ISO instant, when the export ran |
| `observedAt` | optional; the newest shareable card's `observedAt`, if any |
| `openUri` | optional; `portfolio.openUri` |
| `authority` | literal `diagramcloud` |
| `visibility` | `private` \| `shareable`, from `portfolio.indexVisibility` (default `private`) |
| `freshness` | literal `snapshot` |
| `lifecycle` | literal `current` |
| `title`, `rootViewId`, `rootViewTitle` | clipped to 500 chars |
| `storyPresent` | whether the public document has any story steps |
| `lastReviewedAt` | optional; `portfolio.lastReviewedAt` |
| `counts` | see below |
| `items` | see below |

### `counts` keys

`public_views`, `public_components`, `public_evidence_blocks`, `synthetic_evidence_blocks`, `story_steps`,
`story_present` (0/1), `observed_components` (distinct public components with at least one Presented
observation; unreviewed and private observations are not counted), `designed_only_components` (public
components without one),
`shareable_realization_cards`. At most 30 count keys are allowed (`INDEX_LIMITS.counts`); this list uses 9.

### `items`

Only observations that are **reviewed, public and marked shareable** appear (`shareable` already implies
reviewed+public per the `validateDocument` rule above, so filtering on `shareable` alone is sufficient once
the document is built from `publicDocument`). Sorted newest `observedAt` first, capped at
`INDEX_LIMITS.items = 25`. Each item is `{id, title, kind: 'realization', status: <claim>, openUri?}`, with
`title` built as `"<component label>: <summary> (<sourceApp> @ <sourceRevision>, <day(observedAt)>)"`, plus
a caveat suffix when one is set, clipped to 500 chars.

### Never included

Private nodes/views/evidence/assets/sources, the authoring document, `privateNotes`, unreviewed or
non-shareable observations, and Google Drive asset metadata (`asset.remote`) — all of these are already
stripped by `publicDocument` before `portfolioIndex()` runs.

### Example

```json
{
  "format": "diagramcloud.portfolio-index/1",
  "projectRef": "<DATAPASSCONTROL entity_id, or the project's own id>",
  "sourceApp": "diagramcloud",
  "sourceObjectId": "<project-id>",
  "sourceRevision": "14",
  "generatedAt": "2026-09-25T10:00:00.000Z",
  "observedAt": "2026-09-24T09:00:00Z",
  "authority": "diagramcloud",
  "visibility": "shareable",
  "freshness": "snapshot",
  "lifecycle": "current",
  "title": "<project title>",
  "rootViewId": "<root-view-id>",
  "rootViewTitle": "<root view title>",
  "storyPresent": true,
  "counts": {
    "public_views": 4,
    "public_components": 11,
    "public_evidence_blocks": 6,
    "synthetic_evidence_blocks": 2,
    "story_steps": 5,
    "story_present": 1,
    "observed_components": 3,
    "designed_only_components": 8,
    "shareable_realization_cards": 2
  },
  "items": [
    {
      "id": "<observation-id>",
      "title": "<component label>: <summary> (datapass-vscode @ <revision>, 2026-09-24)",
      "kind": "realization",
      "status": "observed",
      "openUri": "https://…"
    }
  ]
}
```

### Size limit and validation before download

`INDEX_LIMITS = {bytes: 64 * 1024, items: 25, counts: 30, text: 500}`. `checkPortfolioIndex()` checks, in
order: serialized size ≤ 64 KiB, no secret-like fields/values anywhere in the raw payload (same
`secretFindings` as observations), then schema validation. `portfolioIndexJson()` throws with the exact
list of refused paths (never their values) if any check fails — the export dialog shows this before a
download is offered, phrased as "Mongoku would refuse it."

`tests/contracts/mongokuProjection.ts` is a verbatim port (formatting aside) of Mongoku's own consumer —
Mongoku-datapass commit `8e83981` (2026-09-25), `src/lib/datapass/projection.ts` `parseProjection`, its
`scrubSecrets` patterns from `aiContext.ts`, and `timeOf` from `cockpit.ts`. It is deliberately not
DiagramCloud code: the portfolio index must pass Mongoku's own rules, not only DiagramCloud's mirror of
them. Update the port when Mongoku's contract changes.

## Deep-link format

`?project=<id>&view=<id>&node=<id>` (`src/core/links.ts`). Only stable IDs travel (`^[a-z][a-z0-9_.-]{0,79}$`);
any other value is dropped by `readDeepLink`. `project` is required; `view` and `node` are optional.
`deepLink(base, target)` builds one by clearing the base URL's existing search/hash and setting only these
three keys.

**Consumption** (`src/App.tsx`): on load, `readDeepLink(window.location.search)` is checked against the
loaded project library. If the linked project is present, `showLinked()` opens it: it resolves the target
view (preferring `view`, else the view containing `node`, else the root view), sets the navigation path so
the parent architecture stays visible (`pathToView`), and selects `node` if it is a member of that view. If
the linked project is not in this browser's workspace, a message asks the user to import it first (JSON /
AI or **Open project folder…**) — DiagramCloud does not fetch anything over the network to resolve a link.

**Copy deep link**: shown as a button in the evidence section header for the selected component, only over
`http:`/`https:` (not on a `file:` origin, where `window.location.href` would not round-trip). It copies
`deepLink(window.location.href, {project: doc.id, view: activeView, node: node.id})` to the clipboard.

## Galaxy roles

These describe integration points other Datapass Galaxy apps use against this contract, not code that lives
in this repository:

- **DataPass VS Code** opens DiagramCloud via the deep-link format above ("Open in DiagramCloud"), and can
  send an observation as a `diagramcloud.patch` built with `observationPatch()`.
- **Mongoku** does read-only reporting from the `diagramcloud.portfolio-index/1` file once it has been
  stored in DATAPASSCONTROL by an operator step; Mongoku also opens DiagramCloud's architecture/evidence
  view via the same deep-link format. Its own projection consumer is what `tests/contracts/mongokuProjection.ts`
  ports.
- **Power Ops (Windows)** is described as the entry point into this Galaxy; DiagramCloud does not implement
  any Power Ops-specific code, only the generic deep-link and portfolio-index contracts above.
