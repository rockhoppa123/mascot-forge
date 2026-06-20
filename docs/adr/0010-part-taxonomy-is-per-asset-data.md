# ADR-0010: Part taxonomy is per-asset data, not a tool constant

**Status:** Accepted  
**Date:** 2026-06-19  
**Deciders:** Andrew Faure  
**Tracks:** v1.1 generalisation, research-log Q7

---

## Context

`tools/segment-parts.ps1` hard-codes DevBrain's 6-part vocabulary (`part-body`, `part-leg-left`, `part-leg-right`, `part-antenna`, `part-eyes`, `part-moustache`) and the geometry predicates that assign blobs to those IDs. Any new mascot either fits this vocabulary or the tool must be edited — which Spike 03 identified as the single highest-value generalisation gap.

---

## Decision

Add an optional `-Spec [string]` parameter to `segment-parts.ps1` pointing to a per-asset `parts-spec.json` file.

- **Default `""`**: existing heuristic runs unchanged, preserving DevBrain behaviour exactly.
- **When provided**: load the JSON, use `parts[].id` and `parts[].hint` to name blobs via hint-dispatch to the same predicate code paths (no new logic).

`parts-spec.json` schema:
```json
{
  "assetName": "<name>",
  "viewBoxSize": <int>,
  "parts": [
    { "id": "<part-id>", "bone": "<bone-name>", "hint": "<hint-string>" }
  ]
}
```

Hint strings and their corresponding predicates:

| hint | Predicate |
|---|---|
| `largest-blob` | rect-group with max total area |
| `below-body-left` | centre.x < body.centre.x AND centre.y > body.bottom |
| `below-body-right` | centre.x ≥ body.centre.x AND centre.y > body.bottom |
| `above-body` | centre.y < body.top |
| `colour-island-upper` | distinct colour region, centre.y in upper half of canvas |
| `below-eyes` | (no existing predicate — part reported as missing if unrecoverable by CCL) |

New assets provide `assets/<name>/parts-spec.json`. The existing DevBrain spec (`assets/devbrain/parts-spec.json`) lists the same 6 parts in the same order and reproduces the existing heuristic output bit-for-bit.

---

## Consequences

- **Human-confirm step unchanged** (ADR-0002): the spec *proposes* part IDs; the human confirms and adjusts pivots.
- **DevBrain behaviour fully preserved**: running without `-Spec` (or with the DevBrain spec) produces byte-identical output to the pre-ADR-0010 tool.
- **New assets**: provide `assets/<name>/parts-spec.json` with their anatomy mapped to hint strings.
- **No new predicate logic**: hints route to the same code paths. Assets with anatomy that doesn't fit the existing 6 predicates will have those parts reported as missing (same as DevBrain's moustache today).
- **Pivot heuristic**: `Get-Pivot` uses `switch -Wildcard` on part IDs — still works for `part-leg-*` and `part-antenna` patterns; other IDs fall through to the bbox-centre default.
