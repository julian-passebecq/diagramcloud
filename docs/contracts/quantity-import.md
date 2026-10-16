# Declared connection quantities in draw.io

This is a bounded correction under `v2:quantitative` (F051/F052/F038) and the unknown-versus-zero part of `r2:metrics-context` / `ux-metrics-context`. It does not implement the full measurement context or an Agent/Config usage receipt.

The existing draw.io adapter reads a quantity only from DiagramCloud's own `dcQuantity`, `dcUnit`, `dcProvenance` and optional `dcQuantityNote` style keys. A label, width or arrow cannot supply a measurement. Without `dcQuantity`, the connection remains unquantified. A supplied but blank or whitespace-only value is invalid; it never becomes the numeric zero returned by JavaScript's conversion of an empty string.

An explicit `0`, including surrounding whitespace or a zero exponent in its numeric declaration, remains zero. A nonzero declaration that underflows JavaScript's number representation to `0` or `-0` is invalid rather than a known zero; representable positive subnormal values remain supported. The existing quantity validator still governs finite nonnegative values and provenance. Synthetic quantities retain their synthetic provenance. The importer rejects newly supplied blank units and malformed URI-encoded units or notes, while preserving valid unit strings verbatim. It does not trim units into a different aggregation group or change the canonical schema for existing authoring documents.

Each invalid quantity declaration is omitted once per connection and appears in the existing import loss report as a counted, generic diagnostic. The discarded value, unit and note are never copied into that diagnostic. The rest of the diagram remains a candidate for normal preview and human Apply; closing the preview leaves the current project unchanged. Supported explicit quantities keep their existing draw.io round trip and public redaction.

Typed measurement windows, scope, sources and freshness; compatible aggregation across those dimensions; usage counter identities, deltas/resets and billing remain open. Missing data stays unknown. No producer receipt, runtime observation, source, current-state verdict or new model/store is invented by this correction.
