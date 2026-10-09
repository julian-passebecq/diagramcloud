# Synthetic product campaign examples, format version 1

Every organization, source, revision and deployment declaration here is fictional. No file attests an actual deployment, test execution or employer result.

- `graph-1.json`, `graph-2.json`: complete selected synthetic scopes with a comparable predecessor and one explicit assertion tombstone. Import the first, author a caption/layout, then review the second. Tombstones produce a downloadable guarded patch, never automatic deletion.
- `native-artifacts.json`: explicitly selected `{path,text}` inputs for Fabric/PBIR/TMDL, dbt v12, Databricks Jobs, .NET solution/project/OpenAPI and Azure Bicep. The companion truth manifest asserts declarations only.
- `project-brief.json`: no-Git guided project, used as the target for `delivery-brief.json`.
- `delivery-brief.json`: environments, instance, artifact digest and promotion approval declaration; every runtime result remains UNKNOWN. Review it against the matching candidate revision.

Run from DiagramCloud, writing only new directories:

```sh
npm run intelligence -- graph --input examples/product-campaign/graph-1.json --out .local/graph-one
npm run intelligence -- graph --input examples/product-campaign/graph-2.json --current .local/graph-one/project.candidate.json --out .local/graph-two
npm run intelligence -- analyze --input examples/product-campaign/native-artifacts.json --out .local/native
npm run intelligence -- brief --input examples/product-campaign/project-brief.json --out .local/guided
npm run intelligence -- delivery --input examples/product-campaign/delivery-brief.json --current .local/guided/project.candidate.json --out .local/delivery
npm run intelligence -- query --input .local/delivery/project.candidate.json --out .local/public-context
```

Query output and the static intelligence report use `publicDocument`. An authoring candidate remains private until a person reviews visibility. Ordinary import, save/reopen and exports work without Brain, Lens, a model or cloud accounts.
