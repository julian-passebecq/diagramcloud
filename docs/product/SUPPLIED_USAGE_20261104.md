# Supplied usage and cost — author workspace

The Workflow dock now exposes the existing `src/intelligence/usageEconomics.ts` leaf-call aggregation through **Supplied usage and cost**, beside compute capacity. This is a private session calculation, not a provider integration, billing calculator or forecast. The shared arithmetic is unchanged.

Supply one explicit UTC reporting window, an assumption basis, and up to 50 leaf-call records. Each record needs its producer authority, stable native call ID and source/provenance. Blank token fields mean unknown; explicit `0` means a supplied zero. Cached input and reasoning output remain subsets and are not added twice. Identical `(authority, id)` readbacks count once; conflicting values or provenance refuse calculation. Parent/run totals are not accepted as additional leaf-call records.

A known cost, including zero, needs its supplied amount, three-letter currency, cost basis and cost/rate citation. Leave all cost fields blank for unknown cost. The source declaration does not verify a rate or bill, and no rate is fetched or applied to tokens. Metered costs, estimates and subscription allocations stay separate; different currencies are never converted or summed together. The single reporting window is a caller declaration applying to every row, not independent timestamp validation against external records. Token counts follow their producers' tokenization and do not compare model quality or work performed.

Each record can allocate up to 10 feature shares in integer basis points (10000 = 100%). Missing shares remain unattributed. Feature filters hide only selected feature output; they never renormalize allocations or change whole-window totals. Proportional token-equivalents are labelled as allocations, not new observed token counts. Known subtotals always display unknown-call counts; an empty cost list is not a zero bill. There is no automatic comparison across reporting windows, scopes or evaluation protocols.

The form decoder bounds text, aggregate draft size (256 KiB), rows, allocations, counts and costs. UTC timestamps require a real `YYYY-MM-DDTHH:mm:ss[.sss]Z` representation and end after start. Token counts must be nonnegative integers up to 1e12; supplied amounts must be finite, nonnegative and at most 1e9. Positive amounts that would round to zero during decoding or allocation are refused. The core validates subset counts, duplicate identity, allocation conservation and safe token totals.

Drafts and results live only in the component. The parent keys the panel by Project ID/revision and unmounts it for public audiences. Editing any input clears the previous result. No Project field, observation, Undo entry, provider request, storage record or export is created. A collapsed disclosure unmounts its controls while retaining the private draft; this avoids the existing native-details/Tabster keyboard trap. Row removal transfers focus to the stable Calculate control, including at the 50-row limit. These session controls deliberately do not enroll in the Project-edit form guard.

## Qualification for this source increment

- `npm run check`: passed.
- `tsx --test tests/usage-economics.test.ts tests/usage-economics-draft.test.ts`: 56 passed.
- `npm run build`: passed; existing Vite chunk-size advisory remains.
- `DIAGRAMCLOUD_E2E_PORT=28673 playwright test tests/e2e/usage-economics.spec.ts`: 6 passed across desktop and 390×844, reduced motion. Real App journeys cover supplied known/unknown records, conserved allocation and feature filtering, explicit zero, invalid window refusal, stale-result clearing, unchanged Project JSON/Undo/storage, public/project/revision invalidation, reload, row bounds and keyboard focus.

This is focused source validation, not a full release qualification or deployed capability. Logs for the implementation run are held by the integrator in `work/tooling/usage-next-{unit,check,build,browser}.log`.

## Remaining scope

Bulk producer-file import, live provider/metering connections, price catalogs, rate arithmetic, cross-window comparisons and protocol-qualified Pareto visualization are not implemented by this panel. The existing headless `paretoByProtocol` API remains unchanged; its lack of currency/window metadata is not bypassed to present a universal ranking. No staffing, agent duration, token forecast, cost-saving or provider-bill claim follows from these sums.
