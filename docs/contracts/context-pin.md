# ProjectContext Follow/Pin

`Pin context` freezes the explanatory panel's project, view and selected component IDs. `Follow selection` resumes the current canonical selection. Canvas navigation and the canonical editor keep their own active target; pinning the explanation never changes what Edit will edit. Actions such as **Open pinned child view** explicitly name the pinned context.

The pointer exists only in the mounted ProjectContext component. There is no new store, persisted preference or Project field. Closing/unmounting the panel or reloading starts Follow. A project switch also starts Follow, including when the new project happens to contain the same entity IDs. The UI labels both the pinned scope and active selection.

The pointer contains no copied facts or old revision. The panel resolves its permitted Project projection on every current revision. Edits to the pinned component appear live with the current revision label; a pin is not a historical snapshot or evidence of unchanged content. Manual `diagramcloud.selected-context/1` downloads keep the existing format and filename and use the target actually displayed, at that current revision.

Public/private filtering happens before pointer resolution. If a pinned target or membership becomes unavailable, the panel hides its detail/evidence/actions immediately and displays a generic unavailable notice. It discards the pointer and remains unavailable until the person chooses Follow or explicitly pins the current permitted selection. Returning from Portfolio to Explore does not revive a revoked private pin. Notices do not disclose the old label, source, evidence or count. Tabs and manual downloads are unavailable while the target is revoked.

`src/core/contextPin.ts` resolves only canonical IDs against the projection supplied by its caller. It accepts no command, URL, authority, data or revision payload; it cannot grant access, navigate, apply patches or author observations. An unknown selected component never silently falls back to its enclosing view when resolving a pin.

The original inherited acceptance is `v2:navigation` and `ux:compact-full` (including “Follow never overwrites pinned view”), retained through the r3/r4 ZIP chain. This local panel implementation does not qualify compact/full transitions in Hub, PM, React or VSIX, add a common environment/variant selector, or implement movable/resizable panels. The exact archived criteria and hashes are recorded in the local Follow/Pin plan.

Focused unit coverage: `tests/context-pin.test.ts`. Browser journeys in `tests/e2e/context-pin.spec.ts` exercise pinned versus active targets, parent retention, Edit, manual-context download, non-mutating authoring JSON, reload, privacy revocation and narrow-screen overflow. Browser/build qualification belongs to the central gate; these test definitions alone are not a PASS claim.
