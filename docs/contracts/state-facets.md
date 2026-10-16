# Independent source state facets

This implements a first slice of `r3:state-facets` / `journey-state-facets`, retaining the parent `v2:revision`, `v2:work-view`, `r2:session-state` and `r2:git-lens-client` criteria. It does not certify their whole acceptance. The canonical contract remains `src/core/model.ts`, Project schema 1 and `validateDocument`.

An external observation may carry an optional `stateFacet` with three required fields:

| Field | Meaning |
|---|---|
| `facet` | One of `lifecycle`, `selection`, `implementation`, `verification`, `distribution`, `runtime` |
| `value` | Nonblank producer text, at most 160 characters, preserved verbatim |
| `scope` | Nonblank producer scope label, at most 160 characters, preserved verbatim |

The enclosing observation supplies component identity, source app, authority, source revision, timestamp, claim, optional source link/evidence and caveat. Scope text is an inert label, not a resolver, project membership, environment identity, permission or selector. It does not join different organizations or repositories because they share a name. Observation secrets checks apply to these fields as well.

Use `observationPatch` and the existing JSON / AI preview and human application. The helper produces private, unreviewed, non-shareable observations against the current Project revision. A person reviews observations and chooses visibility in Edit mode. No automatic author approval, sharing, network access or execution is added. Old documents and observations without `stateFacet` retain their existing behavior.

`stateFacetsFor` projects all six axes from existing observations for one stable component ID. Every source claim and its history remain, newest first with stable-ID ordering for equal instants. It does not select a winner between sources or scopes, merge disagreeing values, or infer the current state. Missing axes are unknown. `not-observed` remains an observation claim, not a revocation or freshness flag. Caveats are displayed as text, never parsed into status.

The Inspector and selection details display these axes separately. For example, a source can report lifecycle `FROZEN` for `release-1`, selection `NOT_SELECTED` for `development` and distribution `DEPLOYED` for `production`. Runtime stays unknown without its own source. A subsequent `CANCELLED` lifecycle claim preserves the component, its implementation evidence, code, view memberships and prior claims. No states are inferred from commit activity, a folder digest, a summary or the illustrative designed status.

A typed state claim never becomes a general component realization/Verified badge. The existing observation cards, public HTML evidence, PowerPoint notes/appendix and shareable portfolio card titles identify the axis, value and scope. Public JSON and DiagramCloud SVG metadata retain permitted facets through `publicDocument`; private, unreviewed and hidden-component observations are removed. Static figure badges and ViewSpec's general observation summary omit typed states. Other adapters are not certified as lossless facet transports; retain the public JSON or author backup when needed.

Galaxy PublicationSnapshot's general `realization_claims` has no state-axis/scope fields. This adapter omits typed facet claims from that list, reporting the public-only count and reason in its `diagramcloud.omissions` extension, rather than converting a verified lifecycle into verification of the whole component. No Galaxy owner schema is changed.

ViewSpec reports the number of scoped claims omitted from its general realization summary, after selecting the requested audience and view membership. Concept exports carry that same note in their loss ledger. Private or unreachable claims never contribute to a public omission count; ordinary documents gain no invented loss.

Still open: producer-specific receipt adapters and explicit revocation/staleness handling from their pinned contracts; current-state reconciliation; project/repository/environment-wide facet navigation; broader account/multi-organization acceptance. Source claims in tests are synthetic protocol fixtures, not real deployments or measured client results. No owner product was modified.
