# STRUCTURE_OVER_SURFACE + VERIFY_SEMANTICS_NOT_FORMAT
# Machine-checkable principle definitions for jingu-policy-core

## P1 — STRUCTURE_OVER_SURFACE

Systems must judge correctness based on parsed structure, not surface text patterns.

**Invariant codes:**
- `GATE_SURFACE_PATTERN_ON_RPP` (error): A gate used regex/includes on llm_output when rpp was available
- `GATE_MISSING_RPP_CHECK` (warning): A gate has no rpp-based check path at all

**Check function:** `checkStructureOverSurface()` in structure-over-surface.ts

## P2 — VERIFY_SEMANTICS_NOT_FORMAT

Validate whether the semantic requirement is satisfied, not whether the formatting pattern appears.

**Invariant codes:**
- `VALIDATOR_FORMAT_PROXY` (error): A validator uses format proxy (keyword presence, word count) instead of semantic check
- `VALIDATOR_LENGTH_PROXY` (warning): A validator uses string/array length as quality proxy
- `VALIDATOR_REGEX_ID_CHECK` (warning): A validator uses regex to validate an ID instead of registry lookup

## Relationship

`.claude/rules/structure-over-surface.md` — behavioral version for Claude
`src/principles/structure-over-surface.ts` — machine-checkable implementation
`src/invariants/codes.ts` — invariant code definitions
