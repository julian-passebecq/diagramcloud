# Review guide: PR #6 (DiagramCloud) and PR #11 (DataPass)

Date: 2026-09-25. Expected time: about 30 minutes to click through, plus whatever time you want to spend reading code.

This guide is for deciding whether to merge. It lists what to open, what you should see, and what only you can judge. Automated checks already cover correctness in depth (see "What is already verified"). Your review matters most where a machine can't judge: whether the screens represent your work honestly, and whether the product feels right.

## 1. What is being reviewed

| PR | Repository | Base branch | Size | Contents |
| --- | --- | --- | --- | --- |
| [#6](https://github.com/julian-passebecq/diagramcloud/pull/6) | diagramcloud | `feat/project-constellation-v1.4` (PR #5) | 32 commits, 42 files, +3,806 / −38 | The earlier Pro-pass work plus this continuation (commits from `97e0bb9` on) |
| [#11](https://github.com/julian-passebecq/datapass-vscode/pull/11) | datapass-vscode | `claude0.9` | 15 files, +4,959 / −1 | DataPass side of the bridge (includes the contract from PR #9) |

Commits in this continuation, in order:

| Commit | What it adds |
| --- | --- |
| `97e0bb9` | Clicking a card explores the diagram; a separate "Open task workspace" strip opens the task screen (fixed the 5 failing browser tests) |
| `fd6b4c5`, `f0897cb`, `94a0f7a` | Bridge V1, DiagramCloud side: open / review / save `.datapass/diagramcloud.json` with a conflict guard; pinned contract files |
| `5dd5daa` | Report view: portfolio-style screens (context rail, KPI trends, charts, status badges, Gantt, filters, insights, steps, tabs); 3 TotalEnergies screens |
| `08b8532` | 5 FOIL screens linked from the Foil'O diagram; formula item; tornado bars |
| `4380767` | Export PowerPoint for one screen: native charts and tables |
| `fd6db66` | Project deck and scope deck: whole project in one PowerPoint with linked contents |
| `f485a33` | Star-schema data-model item and the "Design the semantic model" screen |
| `542d38b` | Drag to move and resize panels in Edit board |
| `636117e` | Undo / redo for board edits |

## 2. Run it locally (5 minutes)

```sh
git fetch origin
git checkout feat/diagramcloud-experience-pro-pass
npm install
npm run build
npm run preview
```

Open `http://localhost:4173` (use Edge or Chrome for the folder features in step 3.6).

## 3. Click-through checklist

Tick each line when you've seen the expected result. Anything unexpected: note the screen and what you saw (see section 7).

### 3.1 Diagram → task screen (2 min)
- [ ] Gallery → **TotalEnergies**. Click the **SQL quality checks** card itself. *Expect:* a deeper diagram opens below; no pop-up.
- [ ] Click the blue **Open task workspace** strip under that card. *Expect:* the task screen opens and the path at the top reads TotalEnergies › Project controls › Validate schedule rows.
- [ ] Close it. Click the **Power BI reporting** card's strip. *Expect:* the BI quicklook dashboard.

### 3.2 TotalEnergies report screens (5 min)
In **Evidence workspaces** → TotalEnergies:
- [ ] **BI reporting and data model → Executive quicklook dashboard**: filters, 4 KPI tiles with ▲/▼ trends, bar chart by asset, donut by region, stacked monthly trend, insight cards, top 5 table, data-load log with a yellow "Pending".
- [ ] **Define a revenue measure**: Source → SQL → Star schema → DAX → Visual strip; the fact table; tabs **DAX measures / SQL source query / Result** switch on click.
- [ ] **Design the semantic model**: 3 fact tables in the middle and 7 dimensions around them, with PK/FK tags, 1 / * marks, and a measures list; the DAX panel reappears here (same item, reused).
- [ ] **Project controls → Plan and track delivery**: Gantt with coloured groups, milestones and dependency lines; task table with Done / In progress / Blocked.

### 3.3 FOIL screens (4 min)
Gallery → **Foil'O Écologie**. Use each card's **Open task workspace** strip:
- [ ] Site and machine inputs → **hydrofoil system**: conversion strip, active-control note, machine data table.
- [ ] PySpark simulation → **physics, Monte Carlo and Spark**: the equation P = ½·ρ·A·Cp·V³ with a symbol list, V³ curve, P90 / P50 / P10.
- [ ] Gold scenario outputs → **techno-economics**: AEP / LCOE / NPV / payback, scenario table with a red −3.4, tornado chart, "Why these numbers differ from the decks".
- [ ] Jobs, catalog and tracking → **Databricks pipeline**: medallion strip, notebook, Unity Catalog list, job runs with one red "Failed", MLflow runs.
- [ ] Streamlit decision app → **scenario decision app**.

### 3.4 Editing (4 min)
Evidence workspaces → **Portfolio remix** → **Edit board**:
- [ ] Drag a panel's **⠿** grip: a dashed outline follows on the grid; drop it somewhere free.
- [ ] Drag a panel's bottom-right corner to resize it.
- [ ] Drag a panel onto another one: the outline turns red and nothing changes on drop (the status line says why).
- [ ] **↶ Undo** names the last step and reverts it; **Ctrl+Z** / **Ctrl+Y** also work.
- [ ] **Report view** shows the new layout. Do not click Save if you want to keep the sample as it was.

### 3.5 Exports (6 min)
- [ ] On any report screen: **Export mini document** → open the downloaded HTML offline; it looks like the screen.
- [ ] **Export PowerPoint** → open it in PowerPoint; click a chart → *Edit Data*; check the speaker notes list the sources.
- [ ] Foil'O project → **Export & share → Project deck (PowerPoint)** → 20 slides; in slideshow mode, click an entry on the Contents slide.
- [ ] Evidence workspaces → FOIL scope map → **Export scope deck**.

### 3.6 DataPass bridge, DiagramCloud side (3 min, Edge or Chrome)
- [ ] **JSON / AI → Open project folder…** → pick any test folder without `.datapass/diagramcloud.json` → **Create repository file**. *Expect:* the status bar shows "Repository … · in sync".
- [ ] In Edit mode, change the project title (Inspector → Apply project), then click **Save to repository** in the status bar. *Expect:* "in sync" again.
- [ ] Open `.datapass/diagramcloud.json` in a text editor and change something, then make another edit in DiagramCloud and click **Save to repository**. *Expect:* "changed after DiagramCloud last read it. Nothing was written.", with **Download backup** and **Reopen repository file** buttons.

### 3.7 DataPass extension (PR #11, optional, 5 min)
Open the datapass-vscode repository on branch `feat/diagramcloud-bridge-v1` in VS Code and press **F5** ("Run DataPass Extension"). In the window that opens, open a project folder that has `.datapass/project.json` (ideally the test folder from 3.6):
- [ ] **DataPass: Copy DiagramCloud AI Context (JSON)…** → "Copy with instructions" → paste into ChatGPT or Claude and ask for a small plan (e.g. rename the diagram).
- [ ] **DataPass: Import DiagramCloud AI Plan…** → paste the answer → tick the change → confirm. Then in DiagramCloud: **Reopen repository file** and review the change.
  The approval pop-ups are the one part automation could not click, so this is worth one manual try.

## 4. What only you can judge

These are content decisions, not code:

1. **Your own wording.** "Role (as stated in the portfolio)", "What was modelled", "What was delivered", "What the model serves" and the rail lines repeat your portfolio slides. Are they still accurate and do you want them public?
2. **Invented numbers.** Every value on the report screens is invented, and asset names are generic ("Asset A"). The slides were used for layout only. Is that the right trade-off, or would you rather show some real (non-confidential) figures?
3. **FOIL figures.** The two decks disagree (e.g. NPV €12.4 M vs €27 M), so the FOIL screens use a third invented set plus an explanation. Is that acceptable to show?
4. **Authored explanations.** Items labelled AUTHOR (e.g. "Design rules" on the model screen) are my explanations, not claims about your job. Keep or remove?
5. **Click behaviour.** Card = explore the diagram; strip = open the task screen. Does that feel right?

## 5. What is already verified

- **Latest CI:** on commit `636117e`, TypeScript, 112 unit tests, the production build and 25 browser tests passed, on both the push run and the PR run.
- **Deeper checks run on your machine:**
  - generated decks, including the ones the browser downloads, open in desktop PowerPoint and every slide was rendered to an image and inspected;
  - contents and section links resolve to the right slides;
  - the HTML exports work offline;
  - a DataPass-edited file is accepted by DiagramCloud byte-for-byte.
- **Things tests assert:**
  - private or draft content never reaches HTML or PowerPoint exports;
  - all user text is escaped;
  - neither deck's headline FOIL figures appear;
  - undo cannot be used to sneak a stale AI import through;
  - bad JSON or bad AI plans are rejected without changing anything.
- **PR #11 (DataPass):** 134 unit tests and 48 real-VS-Code desktop checks passed locally, and its CI (Ubuntu and Windows) passed.

## 6. Merge order

DiagramCloud:
1. Merge **PR #5** (`feat/project-constellation-v1.4` → `main`) first, because PR #6 is stacked on it.
2. Change **PR #6**'s base to `main` (GitHub offers this automatically when the #5 branch is deleted). Check CI is still green, then merge.

DataPass:
1. `claude0.9` holds the V0.9 extension work, including Pass 9.1 from another session, and has **no PR into `main` yet**. Decide whether that line should become `main` (open a `claude0.9 → main` PR) before or together with the bridge.
2. Merge **PR #11** into `claude0.9`. It already contains the contract from PR #9, so **PR #9** can then be closed as included, or merged first on its own if you want the contract on `main` separately.
3. After #11 lands, update DiagramCloud's `docs/contracts/datapass-diagramcloud-bridge.lock.json` to the merged contract commit (the contract README gained additive notes; the schemas are unchanged).

## 7. Known limitations (not bugs)

- The PowerPoint project deck leaves out per-box evidence slides (the architecture-only PowerPoint keeps them). Diagram boxes link to deeper views, not to screen slides.
- Text sizes in PowerPoint are estimated, so a very full panel can look crowded.
- Board undo history lasts while the Evidence workspaces window is open.
- Folder access (bridge) needs Edge or Chrome, and the folder link is forgotten after a page reload.
- DataPass V1 applies only two AI-plan actions (rename diagram / link a box to a screen). Other actions are shown for review but not applied.
- There is no in-app editor for data-model tables yet (use Workspace JSON / AI).

If something is off, tell me the screen, what you clicked and what you saw (a screenshot helps), and I'll fix it on the same branch.
