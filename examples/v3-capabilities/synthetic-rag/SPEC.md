# Synthetic example: document question-answering service

SYNTHETIC. This specification is invented for a DiagramCloud example. No repository, team, deployment or measurement exists behind it.
Every line below is a design statement written for teaching, not a fact read from a real system.

## Purpose

The service answers questions about a collection of public documents and cites the passages it used.
It mixes a traditional batch pipeline (ingestion and indexing) with an agentic step (a planner that may call tools).

## Components

- Ingestion job: reads documents from a folder on a schedule and splits them into passages.
- Embedding step: turns each passage into a vector with an embedding model; the model is not chosen.
- Vector index: stores passage vectors and passage text; the product is not chosen.
- Retrieval API: an HTTP endpoint that takes a question and returns the top passages with their document identifiers.
- Agent planner: decides whether to answer from retrieved passages or call a tool (search again, or a calculator).
- Answer generator: a language model writes the answer from the passages and must cite passage identifiers.
- Evaluation harness: replays a fixed question set and compares answers with expected passages.

## Interfaces

- HTTP: POST /ask with a question; the response holds the answer and a list of cited passage identifiers.
- Command line: an `ingest` command that runs the ingestion job once for a folder.
- Command line: an `evaluate` command that runs the evaluation harness against a question set file.

## Origins

- The ingestion, retrieval and evaluation split follows the common retrieval-augmented generation pattern.
- The planner step follows the common tool-calling agent loop: plan, call a tool, observe the tool output, answer.

## Limits

- No language model, embedding model, vector index product or hosting provider is selected.
- No latency, cost, accuracy or throughput figure exists; any number would be invented.
- The planner may loop; a maximum of three tool calls per question is a design rule, not a measured behaviour.
- Answers may be wrong even with citations; the evaluation harness only checks cited passages, not truth.
