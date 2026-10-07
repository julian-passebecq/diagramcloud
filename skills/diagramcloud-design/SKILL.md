---
name: diagramcloud-design
description: Graph any repository or multi-repository project with DiagramCloud and draw it in Diagram Design mode. Use when asked to diagram a codebase, a set of projects, an architecture or a data lineage as an editorial figure (architecture, layer stack, exploded 3D stack, drilldown tree). The agent scans, then writes a design brief; it never invents components or edits the document by hand.
---

# DiagramCloud · Diagram Design

DiagramCloud knows **what is true** (components and links read from repositories, each with file:line evidence, a revision per repository, planned vs read-from-source). Diagram Design mode decides **how it looks** (diagram-design's visual grammar, MIT). You, the agent, connect the two with a **design brief**: which figure each view gets, which one or two components are the point, and a one-line caption.

## 1. Get the facts (never from memory)

| Situation | Command | Result |
|---|---|---|
| One repository | `npm run scan -- <folder> --out repo.json` | System → Containers → Components → Files, data lineage, infrastructure |
| Several repositories | write `project.manifest.json` (explicit members only), then `npm run atlas -- project.manifest.json --out atlas.json` | One atlas, each repository at its own revision |
| An existing project | the user's `diagramcloud.json` or an authoring export | as authored |

Rules: never add a component, link or repository the scan or manifest did not produce. Do not read secret files. A scan is `static-source` evidence, not an observed or verified result.

## 2. Pick a figure per view

| The view is about… | Figure (`type`) | Why |
|---|---|---|
| How parts talk to each other (services, APIs, stores) | `architecture` | boxes and rounded right-angle connectors; routes avoid boxes |
| What sits on what (experience, services, control, data, sources) | `layers` | one band per layer, links counted between bands |
| Levels of detail: overview, then what is inside one part | `exploded` | the drilldown chain as stacked 3D planes, the parent kept on top |
| Where everything is (all views and what opens them) | `tree` | the drilldown hierarchy, current view highlighted |
| Who owns which step (several repositories or layers) | `swimlane` | lanes by repository, else by layer; columns in reading order |
| The path of one request, save or event | `sequence` | lifelines and numbered messages from the view's connections (reading order, not timing) |
| The walkthrough | `timeline` | the guided story steps on an axis |
| The numbers behind a component | `chart` | bars from a table evidence block; its provenance stays printed (synthetic stays synthetic) |
| Where things run (providers, platforms) | `deployment` | components nested by provider |
| How much is backed by source | `matrix` | basis × confidence grid |
| How big each part is | `treemap` | drilldown hierarchy as nested tiles |
| What touches one component | `hub` | the component and its direct neighbours |
| Patterns across a table | `heatmap` | shaded cells, provenance printed |
| A trend in a table | `line` | lines with direct labels, provenance printed |
| What enters and leaves a system | `context` | boundary with sources left, sinks right |
| Which parts are in which designed state | `status` | board by designed status (not observed) |
| Where something comes from and goes | `lineage` | upstream and downstream of one component |
| What a change here could reach | `radial` | rings at 1, 2 and 3 steps |
| How much moves along each connection | `sankey` | bands sized by connection quantities, provenance printed (needs `quantity` on connections) |
| Which repositories moved since the last atlas | `atlas` | per-repository revisions, Δ / + / − (atlas documents only) |

Leave `auto` (= architecture) when unsure. Budget: a figure reads well up to about 9 components and 12 connections; above 24, explain with drilldown views instead of one large picture.

## 3. Choose focal components (0 to 2)

Focal is the accent colour: the one or two components the reader must notice (where a decision is made, where data lands, the part that changed). Use IDs from the view. More than two cancels the signal: Diagram Design keeps two and reports the rest. With no focal, the figure picks the single most-connected component, if there is a clear one, and says so in the legend.

## 4. Write the brief

```json
{
  "format": "diagramcloud.design-brief",
  "version": 1,
  "projectId": "<document id>",
  "author": "<agent name>",
  "views": [
    {"viewId": "overview", "type": "exploded", "focal": ["api", "store"], "theme": "light", "caption": "One sentence a reader keeps.", "why": "Short reason, shown in the review."}
  ]
}
```

Themes: `light`, `dark`, `editorial` (adds the drilldown path, revision vector and provenance cards). A caption is at most 300 characters, describes the figure, and never claims a measured result. Full example: `docs/design-brief.example.json`.

## 4b. Start from the suggestions

`npm run design -- doc.json --out figures/` writes `figures/suggestions.json`: for every public view, the five best figure types with the fact behind each. Start from it, then choose by the question the figure must answer; keep the reason in the brief's caption when it helps the reader.

## 5. Render or hand over

- What changed after a rescan: `npm run design -- new.json --delta old.json --out figures/` (Before · Changes · After per view, by stable ID).

- Render every public view: `npm run design -- atlas.json --brief brief.json --out figures/` (static offline SVG plus `index.html`; the document file is not modified).
- Or give the brief to the person: in DiagramCloud, open **Diagram Design**, switch to Edit, choose **Read design brief…**, review, apply.

## Never

- Edit `diagramcloud.json` directly, or write observations, reviews or "shareable" flags (those are the author's decisions).
- Turn a synthetic or illustrative value into a result, or present a scan as observed or verified.
- Put private repository names or private components in a public figure: figures are built from the public document, so mark private things private instead of leaving them out of the brief.
