# Artifact Studio and publishing architecture

Status: architecture target for DiagramCloud / Datapass project artifacts.

## Decision

Use a split storage model:

- **Google Cloud Storage (GCS)** is the canonical machine-facing object store for reusable binary assets and generated image artifacts.
- **Google Drive** is the human-facing publication and sharing library for final PDF, PPTX, CV, portfolio and review deliverables.
- **BigQuery** stores the searchable artifact catalog and analytical metadata; it does not store the binary files.
- **GitHub / structured JSON** stores diffable templates, content definitions, renderer code and project manifests.
- **Artifact Studio** is the visual authoring/rendering layer. It may reuse selected MIT-licensed ideas/code from `clawnify/OpenDesign`, but its persistence and renderer contracts remain Datapass-owned.

This avoids treating Drive as an application object store and avoids treating GCS as the place where a human browses every final document.

## Target flow

```text
GitHub / structured content / templates
                 |
                 v
        Artifact Studio
   +-------------------------+
   | shared scene/document   |
   | model                   |
   |                         |
   | Fabric.js canvas        |
   | (OpenDesign donor)      |
   +------------+------------+
                |
        renderer adapters
         /       |       \
        /        |        \
     PNG       PDF       PPTX
      |          |          |
      v          v          v
     GCS      Google Drive  Google Drive
      |          |          |
      +----------+----------+
                 |
                 v
              BigQuery
          artifact catalog
                 |
       +---------+----------+
       |                    |
       v                    v
 DiagramCloud evidence   portfolio/CV/site
```

## Why GCS for image artifacts

GCS is the better canonical store for machine-generated PNG/JPEG/WebP/SVG and source images because it provides:

- stable object URIs;
- object generations / immutable object identities;
- programmatic upload/download;
- lifecycle rules;
- clean integration with BigQuery metadata/object workflows;
- predictable project/workspace naming.

Suggested bucket structure:

```text
gs://datapass-artifacts/
  career/
    cv/
      source-assets/
      previews/
      diagrams/
      screenshots/
  portfolio/
    website/
    decks/
    architecture/
  foil/
    wind/
      architecture/
      screenshots/
      reports/
  datapass/
    diagramcloud/
    studio/
    contoso/
```

Prefer stable logical artifact IDs rather than relying on filenames alone:

```text
{workspace}/{project}/{artifact_kind}/{artifact_id}/{version}/{filename}
```

Example:

```text
career/cv/previews/cv-cloud-bi/v007/cv-cloud-bi-page-1.png
```

## Why Drive for final PDF/PPTX/portfolio files

Drive is the publication library because it is convenient for:

- previewing files;
- manually organizing final versions;
- sharing links;
- downloading from any device;
- opening PPTX/PDF for human review;
- keeping a simple "Published" folder structure.

Suggested Drive tree:

```text
Datapass Published/
  Career/
    CV/
      Current/
      Archive/
    Portfolio/
      Current/
      Archive/
  Foil/
    Architecture/
    Reports/
  Datapass/
    DiagramCloud/
    Contoso/
    Learning/
```

Drive should not be the canonical store for every transient screenshot or generated preview.

DiagramCloud already has an optional Google Drive connector. That connector remains appropriate for importing image evidence and archiving exported PNG/PDF/PPTX files.

## BigQuery artifact catalog

Suggested table:

```text
datapass_catalog.artifacts
```

Core fields:

| Field | Purpose |
| --- | --- |
| artifact_id | stable logical artifact identity |
| project_id | CV, portfolio, foil, diagramcloud, etc. |
| artifact_type | image, screenshot, pdf, pptx, html, source |
| version | logical document version |
| sha256 | content identity / duplicate detection |
| gcs_uri | canonical binary object when applicable |
| gcs_generation | immutable GCS object generation |
| drive_file_id | published Drive file when applicable |
| drive_web_view_link | human review/share link |
| mime_type | object content type |
| created_at | render/upload timestamp |
| source_commit | Git commit producing the artifact |
| template_id | source template when generated |
| tags | project/search tags |
| publication_state | draft, review, published, archived |

BigQuery stores metadata and searchable text/chunks where useful, not PPTX/PDF/PNG bytes.

## Artifact Studio

### Do we need a canvas?

Yes, for visual authoring.

A CV/portfolio system needs two complementary lanes:

1. **Structured document lane**
   - CV sections;
   - project cards;
   - experience entries;
   - reusable text blocks;
   - deterministic data/content;
   - ideal for repeatable PDF/PPTX/HTML generation.

2. **Free-form canvas lane**
   - covers;
   - architecture pages;
   - project one-pagers;
   - screenshots;
   - image composition;
   - visual spacing and positioning.

The canvas must not become the sole source of truth for CV content.

### OpenDesign as donor

`clawnify/OpenDesign` is MIT licensed and currently provides a useful implementation reference:

- Preact + TypeScript;
- Fabric.js canvas;
- text/shapes/images/backgrounds;
- undo/redo;
- zoom;
- templates;
- HiDPI PNG export;
- local SQLite persistence;
- explicit agent-friendly controls.

Useful donor components:

```text
editor layout
canvas interaction model
toolbar / properties panels
templates
undo / redo
zoom
image placement
agent-friendly controls
```

Do not copy its storage assumptions as our final architecture.

OpenDesign currently focuses on social graphics and PNG export. Datapass Artifact Studio needs additional document semantics and renderers.

## Shared scene/document model

Do not make Fabric.js canvas JSON the only portable format.

Use a Datapass scene schema such as:

```json
{
  "documentId": "portfolio-cloud-bi",
  "pageSize": "A4",
  "pages": [
    {
      "id": "page-1",
      "elements": [
        {"type": "text", "id": "title", "x": 48, "y": 50},
        {"type": "image", "id": "architecture", "assetId": "artifact-123"},
        {"type": "shape", "id": "divider"}
      ]
    }
  ]
}
```

Fabric.js becomes an editor adapter over that model.

Renderer adapters consume the same scene/document model.

## Renderer rules

### PNG / WebP

Use for:

- website images;
- architecture thumbnails;
- screenshots;
- preview pages.

Canonical binary goes to GCS.

### PDF

Use for:

- CV;
- printable portfolio;
- project brief.

Keep text/vector output where practical. Do not intentionally rasterize an entire CV page if avoidable.

Published output goes to Drive. A reproducibility snapshot may also go to GCS.

### PPTX

Use for:

- editable portfolio;
- architecture deck;
- presentation handoff.

Where practical, map text, shapes and images to native PPTX objects instead of using one flattened screenshot per slide.

Published output goes to Drive. A reproducibility snapshot may also go to GCS.

### HTML

Use for:

- portfolio website;
- embedded project stories;
- preview mode.

Reference approved GCS assets rather than embedding large image data directly.

## Templates to support first

1. A4 CV
2. A4 portfolio
3. 16:9 portfolio deck
4. architecture one-pager
5. project case-study page
6. LinkedIn square/landscape
7. website hero/project image

## Storage cost / residency note

The architecture must not assume that "GCS" means "free everywhere."

If the strict zero-cost Google Cloud free tier is the goal, validate the currently eligible regions and quotas before provisioning.

For personal CV/portfolio files where European residency matters, prefer the desired EU region even if that means a small storage charge rather than moving sensitive material to a distant region only to save a negligible amount.

## Azure

Do not add Azure Blob Storage as the global artifact store merely because Fabric/Azure projects exist.

Use Azure-native storage inside Azure/Fabric-specific labs when it teaches or supports that architecture.

For the cross-project artifact platform, GCS + Drive + BigQuery gives one coherent Google-side stack and avoids duplicating storage/authentication systems.

## DiagramCloud responsibilities

DiagramCloud should:

- visualize this architecture;
- link evidence images;
- import/back up Drive image evidence through the existing Drive connector;
- export architecture PNG/PPTX/HTML;
- show artifact metadata/provenance;
- link to Artifact Studio for richer design editing.

DiagramCloud should not become a Canva replacement itself.

## Next implementation milestones

1. Keep current DiagramCloud Drive connector.
2. Add GCS artifact-provider interface.
3. Add artifact manifest schema and BigQuery catalog SQL.
4. Prototype Artifact Studio from OpenDesign interaction patterns.
5. Add A4 + 16:9 templates.
6. Add shared scene/document schema.
7. Implement PNG renderer.
8. Implement PDF renderer.
9. Implement native/editable PPTX renderer.
10. Add Drive publishing adapter and GCS object archival.
