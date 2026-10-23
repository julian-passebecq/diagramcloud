# In-App authored explanations - Pro increment, 23 October 2026

This is a source contribution to existing UX31, not a new backlog, release or whole-Studio completion. The 1.33.1 reliability release (#125-#128) remains delivered at main `2ea334fa80f44b42f1b1e670e4193b09f7df0b27`. Independent packaging maintenance #129 is now fully green in CI39883730344 and remains with the native integrator.

## Selected outcome and boundary

In Edit, open Tours -> Author explanation. Choose exact existing components/connections, supply a question and ordered narration, and optionally add before/after state, cited provenance and a frozen code excerpt. Review produces the existing compiler's private patch and uses the shared change-preview/detail components. It applies nothing. Explicit Apply goes through the existing Tours host commit, one revision and one Undo. Public/Present surfaces do not expose the form or private additions.

The form captures project/revision/full fingerprint. Prepare AND Apply reject drift, including same-revision changes. Back to request retains its original basis and authored fields; it never rebases silently. Escape offers Keep editing/Discard for a dirty request, with a private request download and beforeunload warning. A downloaded draft may be incomplete or stale; it is not a saved Project. A missing Tours collection requires a separate explicit, undoable initialization. Existing compiler bounds, citation requirements, private projection and code-range validation are unchanged.

No code, API, model, simulation or target system executes. Step order is presentation order, not timing or causal proof. This first form covers narrative, subjects, state, code and takeaway; explicit prerequisite/case/question fields remain available in the existing request format/CLI rather than invented from form order. A request-download importer, disk autosave and background enrichment are not added.

## Architecture and fileset

`src/intelligence/explanationRequestDraft.ts` captures source identity, constructs drafts and delegates to the existing compiler/patch validator. `src/ui/ExplanationRequestDialog.tsx` owns draft input. `src/ui/ExplanationAuthoring.tsx` owns review and the final effect guard. Tours adds only an import and the host component. The small stylesheet loads through `src/main.tsx`.

App.tsx, the canonical model, compiler, patch semantics, dependencies, lockfile, product version, workflow, renderer and packaging remain unchanged. This is independent of #129's source changes. One native integrator owns eventual composition, checkpoints, release identity and main. No native worktree/session was observed or launched; recover local dirty state before adoption.

## Evidence at source publication

Local Linux/Node22.16: **89 source checks PASS / 0 FAIL / 0 SKIP**, including 24 new draft/effect checks and unchanged compiler, tour-reference, source-anchor and documentation checks. Seven changed/new TS/TSX modules pass syntax transpilation; this is NOT a full semantic typecheck.

Pinned dependency installation/clone could not complete because DNS was unavailable. Local checks load actual TypeScript production modules via temporary tooling outside the repo, using TypeScript5.8.3 and exact Zod3.25.76 recovered from the previously digest-verified CI bundle. No compiler or patch algorithm is mocked. This is not the normal locked tsx run. One initial fixture-language error was corrected; a separate adoption-journey module could not load React and is NOT_RUN, not a passing product test. Raw attempts remain in the conversation evidence archive.

Eight new real-App Playwright cases are supplied at1440/390: no-mutation review, apply/Undo/Redo/reload/privacy; Escape/discard/focus/overflow; invalid code range preserves draft; missing Tours initialization and Undo. They have NOT_RUN locally. The PR's existing full pinned CI owns typecheck, units, build, normal browser cases and packaging qualification. Update this evidence from observed results, not assumptions.

## Native continuation and acceptance

Review the exact PR head and its full CI, including the eight new cases and existing mobile Tours/V3 regressions. Diagnose any failure without weakened assertions. Confirm the form journey visually in a disposable profile and verify Back to request preserves inputs; owner storage must remain untouched. Reuse matching passing receipts for unchanged inputs. Reconcile #129 separately; never restamp an old dist or overwrite released packages.

After actual App qualification, update UX31 in V3_WORKSPACE, the user/AI guide and native RESUME/ROADMAP together. Do not mark all expressiveness or Studio work complete. Integrate and publish only under the existing native release grant; main auto-deploys and the new deployed SHA needs applicable acceptance. Public privacy, host installation and external integrations remain distinct.

Subsequent independent choices remain explicit source refresh/return context and meeting-summary publication parity. Wider cross-project correspondence, docking and capacity/result reasoning retain their existing acceptance and owner/producer decisions. No rewrite, new harness/service/orchestrator, spend or other Galaxy product is selected here.
