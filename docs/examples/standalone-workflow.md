# Standalone synthetic workflow

`tests/fixtures/overnight-workflow` is a small independent teaching repository. It needs no Galaxy identity, organization, account, bridge, agent or T3. DiagramCloud reads the fixture as text; it never executes the functions.

From **New analysis**, select **Repository · Auto**, then that fixture folder. Review and apply the proposed document. **Structure** lists admitted sources and reports an unresolved relative link at its README source line: the fixture deliberately references a runtime receipt that was not supplied. **Relationships** exposes static dependencies; **Evidence / gaps** and **Details panel → Gaps** keep unknowns visible. Source-derived means derived from these synthetic source files. It does not mean verified runtime.

Choose **Vanilla** in **Presentation profile** for a compact workspace. Architecture, relationships, evidence, editing, JSON backup and exports remain directly available; **More tools** holds the visual renderers. **Standard** shows those tools directly. **Advanced** also offers source and revision shortcuts when available. The preference is saved for this project and host; it never changes the document, source scope, analysis depth, assistance or access rights.

For a text-only assistant, use the native [ProjectBrief example](../../examples/project-intelligence/project-brief.json) and the [AI guide](../AI_GUIDE.md): describe only the supplied sources, retain synthetic labels, then paste the proposed JSON into **New analysis → Guided**, review and apply it. An existing document needs a revision-guarded patch through **JSON / AI**, rather than a replacement brief. No CLI, SDK or account is required for that review path.

Select a component, choose **Edit**, change its summary and **Apply component**. Save/reopen preserves the annotation and stable ID. A public demonstration can be prepared through the existing JSON import review by explicitly publishing only the synthetic components and evidence intended for the story. Private notes and private evidence remain excluded from public outputs.

**Mosaic preview** prepares the selected view as either a public projection or a private author packet. Download its packet, concept and source mapping. Existing host integration documents explain local viewing; a successful file download alone does not qualify WebGL or direct viewer picking.

Reproduce inspectable demonstration outputs from the repository root:

```powershell
npx tsx scripts/overnight-demo.ts --out .local/overnight/demo/my-new-run --print
```

The destination must be a new child of `.local/overnight/demo`. The script reuses the existing scanner, canonical validator, public projection and exporters. It checks source evidence against file lines and writes authoring JSON, public JSON, offline interactive HTML, ordinary/editorial SVG, an editable PowerPoint, Mosaic packets and a SHA-256 artifact manifest. With `--print`, installed Chromium also prints the public technical manual to PDF and rasterizes the existing editorial picture deck. Missing Chromium is an error, never a simulated pass. PowerPoint still needs native visual inspection.

The synthetic private authoring JSON and author packet belong in private local storage. `READY.json` records the actual source commit plus a modified-working-tree qualification limit. No generated files or real client data are committed, and no output is published. Unknown deployment, timing, traffic and business outcomes remain unknown.
