# Lane report: herd architecture document (8 Nov 2026)

Lead session on the owner's Windows machine, Opus 5.5. Goal: describe the owner's private multi-machine agent setup in
DiagramCloud, with each variable part as a slot whose candidates are decided by lab experiments, and improve DiagramCloud
where it could not express that.

## What changed
- #158 (illustrative agent memory and work map, prepared by Codex) marked ready and squash-merged on green (e5ff301).
- #159 (coder agent) added slot decisions: option `testPlan` and `rejection {reason, decidedAt, decidedBy?}`, choice
  `observationIds[]`, the `decisions` Diagram Design figure (SVG, HTML book, PPTX deck), Inspector display, AI_GUIDE and
  tests (`tests/slot-decisions.test.ts`, `tests/e2e/slot-decisions.spec.ts`). Lane report: `2026-11-08-slot-decisions.md`.
- A private architecture document (60 components, 13 views, 16 slot decisions, 17 experiment observations awaiting review)
  was built outside this repository: ProjectBrief → `npm run intelligence -- brief`, then one revision-guarded patch
  (`validate-proposal`: valid), then the lab's recorded adoptions/rejections as a second patch. Nothing private is committed here.

## How verified
- #159: GitHub Actions run 42428308639 success (2339 unit tests, 2336 pass, 3 skipped; 467 Playwright, 5 skipped; 5/5 component tests).
- Private document: `validateDocument` passes on both revisions; `npm run design` renders every view, including `--type decisions`;
  offline HTML has no external request; a pattern scan found no IP, e-mail or token strings in any exported file.

## Problems hit
- ProjectBrief child views carry no connections and every generated item is private, so public exports were empty until a
  patch added view edges, export visibility and layout (Auto layout stacks a fan-in overview into one column; the overview got an explicit placement).
- ProjectBrief caps scope at 60 items; four minor components were folded into their neighbours' summaries.
- Decisions recorded by an external lab (not the document author) cannot pass the proposal validator: accepting a choice or
  recording a rejection is `self-review` on every proposal path, by design. They were applied as an imported record naming the lab as decider.
- A choice has one chosen option; a slot with several adopted candidates is split into one accepted choice per extra candidate.
- A choice holds at most 12 options; a 21-candidate slot was split into two choices.

## Remaining issues
- The decisions figure legend says "Adopted means a person recorded the decision"; an agent or lab decider is named in the row
  line but the legend wording does not cover it.
- The decisions figure draws at most 12 rows and reports the rest as not drawn.
- No Edit-mode form records a rejection or a test plan (JSON drawer or patch only).
- Experiment observations stay unreviewed until a person reviews them in Edit mode, so exports cite none of them.

## Next steps
- Legend wording for non-person deciders in the decisions figure — one patch.
- An explicit "external decision record" import path (decider, source, date) that the review shows as imported rather than refusing — dispatch.
- Edit-mode form for test plans and rejections — dispatch.
