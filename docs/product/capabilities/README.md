# Capability examples (V3, W2)

Two ordinary DiagramCloud Project documents that describe what an application can do, each built from an explicit capability guide with `compileCapabilityGuide` (`src/intelligence/capabilityGuide.ts`). They are examples to open, read and export. Nothing in them was observed, reviewed or certified.

| Example | Project document | Guide (input) | Basis |
|---|---|---|---|
| DiagramCloud describes its capabilities | `examples/v3-capabilities/diagramcloud-self.project.json` | `tests/fixtures/v3-capabilities/diagramcloud-self.guide.json` | Static source: every statement cites a file and line of this repository at the recorded source cut |
| Synthetic document question-answering service | `examples/v3-capabilities/synthetic-rag.project.json` | `tests/fixtures/v3-capabilities/synthetic-rag.guide.json` | Synthetic: invented in `examples/v3-capabilities/synthetic-rag/SPEC.md`; every block is labelled `synthetic` |

## Open one in DiagramCloud

1. Start the studio (`npm ci`, then `npm run dev`) or use any deployed build.
2. In the gallery, open **JSON / AI** (or the import dialog) and choose the `.project.json` file. The document goes through the ordinary validation and review, then opens as a new project. The open project is not changed.
3. The root view has three cards:
   - **Capabilities**: one card per capability. Open a capability to see its scope table and its sections (how to use, how it is built, origins, checks, limits), each with the cited sources.
   - **Interfaces**: the same capabilities grouped by entry surface (browser studio, CLI, MCP, React module, HTTP API...), without copying a capability.
   - **Implementation and reuse**: capability-to-technology associations as declared in the guide, not an inferred dependency map.
4. **Portfolio** mode and every export show the public projection. The guide's source-cut record is private context and is not exported.

To read the same content from a terminal, any CLI that reads a document works, for example `npm run intelligence -- query --input examples/v3-capabilities/diagramcloud-self.project.json --out <new-folder>`.

## Change or regenerate

Edit the guide, not the Project: the Project is derived. Then run

```sh
npx tsx examples/v3-capabilities/write.ts
npx tsx --test tests/v3-capabilities.test.ts
```

`tests/v3-capabilities.test.ts` checks that each guide passes the capability guide validator, that each committed Project equals the compiled guide and passes `validateDocument`, that every citation names an existing file with its anchor text on the cited line, that nothing is observed or reviewed, that unsupplied detail reads UNKNOWN, that the public projection drops private context, and that the synthetic example is labelled synthetic everywhere.

When a cited file moves, the test names the source to update: change its line in the guide's `location` and `url`, or re-cut every citation at a new commit and record that commit as the source cut (see [EVIDENCE-HANDOFF.md](EVIDENCE-HANDOFF.md)).
