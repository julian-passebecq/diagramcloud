# Bounded join and meeting publication helpers

`inspectJoin` is a pure calculation over two explicitly supplied relations. Both aliases differ, rows and columns have stable unique IDs, and types/nullability are explicit. Limits: 200 rows per relation, eight columns, four key pairs, 100 preview rows, finite bounded numeric inputs. Supported joins: inner and left equijoin. Null keys never match, implicit casts/collation/temporal predicates/SQL execution are not implemented.

Output reports both unmatched rows and fanout, exact output count within the supplied cohort, a bounded preview, and row correspondence. An optional additive left numeric measure is shown before and after alongside missing inputs. No population-wide correctness is inferred from samples or a `declared-complete` label. JavaScript numbers are not a decimal accounting engine. The helper does not infer that every fanout is wrong: multiplicity must be declared.

`joinInspectionBlocks` returns six ordinary transformation blocks (two inputs, logic, output, mapping, rules). All default PRIVATE, including synthetic requests. An explicitly authored public synthetic fixture may publish its own blocks. Source IDs must resolve in the owning Project; `validateDocument` remains required. No observations/review/authority is created.

`meetingSummaryHtml(Project, PublicationBrief, {now?})` uses the existing publication-brief contract, native overview projection and SVG renderer. At most six selected public views. Supported profiles: design and business. A4/letter print CSS, or A4 print fallback for screen-oriented input. Overview intentionally omits evidence bodies; standard/full include selected public blocks. Dense diagrams use an explicit fallback and complete component list, not unreadable microtype. It is a static, self-contained public HTML publication, not a full source backup or a private hosting system. Source-derived public captions backed by private sources are suppressed with existing overview rules.

The existing linked HTML reader also supports moving ONE detail dock below both views or below the companion. Closing the companion temporarily returns the same dock to the bottom; reopening restores its selected placement. This is a bounded exported-reader composition, not a new arbitrary docking engine or proof of integrated App state. It preserves exact/mapped selection, independent cameras and the business anchor from F/G.

Prepare the original synthetic example explicitly in a fresh output directory:

```sh
./node_modules/.bin/tsx scripts/prepare-review-workspace.ts --example NEW_DIRECTORY
```

The command generates ordinary Project/reading/publication JSON, a join request/result, interactive reading HTML and a static meeting summary. It never executes SQL, connects to a provider or overwrites an existing directory. The App can consume ordinary Project JSON through its normal validation route; new helpers are not extra automatically accepted top-level JSON formats.

Native source checks: `tests/join-inspection.test.ts`, `tests/meeting-summary.test.ts`, `tests/review-workspace.test.ts`. Integrated browser testing, publication byte/fidelity inspection, actual client storage and full required gates remain the native lead's responsibility.
