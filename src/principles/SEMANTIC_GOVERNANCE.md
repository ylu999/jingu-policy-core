# Semantic Governance Principles

**Canonical definition.** Source of truth for Semantic Baseline Validation.
Consumer-facing behavioral guide: `~/.claude/rules/semantic-governance.md`
CI enforcement: `scripts/check-baseline-semantic.mjs` in jingu-agent

---

## Problem Statement

Baseline governance (B010) enforces the presence of justification, but not its validity:

```
[BASELINE_CHANGE]

JUSTIFICATION:
"minor refactor"    ← syntactically valid, semantically meaningless
```

This justification would pass B010's checks even if R1 exceptions grew from 1 to 10.
Semantic governance closes this gap: the justification must match the type of change.

---

## Core Insight

```
B010 = syntax governance  (has justification?)
B011 = semantic governance (justification matches change?)
```

A justification is semantically valid if it:
1. Acknowledges the specific type of change (violation increase vs exception increase)
2. Provides a reason that is congruent with that change type
3. Does not use generic filler words that apply to any change

---

## Semantic Validation Rules

### SR1 — Violation Increase Requires Causal Justification

**Trigger:** any rule's `violations` count increases

**Valid justification signals:**
- `intentional` — explicitly declaring this is a known, chosen state
- `tradeoff` — acknowledging a competing constraint was prioritized
- `acceptable` — explicitly evaluating the risk and accepting it
- `known` — acknowledging awareness of the violation

**Invalid justification examples:**
- "minor refactor" — does not acknowledge the violation
- "temporary fix" — does not explain why a violation is acceptable
- "CI was failing" — describes a symptom, not a reason

**Rationale:** A violation increase means the system is less correct in some dimension.
The justification must explain why that reduced correctness is acceptable, not just
describe what was done. "I did X" is not "X is acceptable because Y."

---

### SR2 — Exception Increase Requires Exception Acknowledgment

**Trigger:** any rule's `exceptions` count increases (allowlist grew)

**Valid justification signals:**
- `exception` — explicitly acknowledging an allowlist entry is being added
- `allowlist` — naming the mechanism being used
- `exempt` — explicitly identifying what is being exempted and why
- `temporary` — declaring the exception as time-bounded (must include resolution path)

**Invalid justification examples:**
- "updated test file" — does not acknowledge that an exception was granted
- "refactored code" — does not explain why a new entity needs special treatment
- "minor change" — does not acknowledge the exception's existence

**Rationale:** Exceptions are the primary leakage mechanism for closure degradation (P4 in
CLOSURE_DRIFT.md). Every exception must be explicitly acknowledged as such — not embedded
in a generic description of code changes.

---

### SR3 — Closure Level Decrease Requires Explicit Acknowledgment

**Trigger:** `closure_level` field decreases (e.g., L5 → L4)

**Valid justification signals:**
- `L<N>` where N is the new level — explicitly naming the new closure level
- `level` — reference to the closure level

**Rationale:** A closure level decrease is a significant event — the system is no longer
at its target closure state. This must be explicitly acknowledged in the justification,
not implied by the description of individual rule changes.

---

### SR4 — Improvement Changes Are Always Valid

**Trigger:** violations and exceptions counts decrease only (no increases)

**No semantic check required.** Improvement-only changes are always acceptable.

**Rationale:** The one-way ratchet principle (BASELINE_GOVERNANCE.md P1) establishes
that improvements are always in the right direction. Adding semantic requirements to
improvement changes would create friction without safety benefit.

---

## Signal Word Design

Signal words are chosen for specificity, not length. The goal is to ensure the author
has consciously addressed the change type — not to force verbose text.

```
violation increase   → ["intentional", "tradeoff", "acceptable", "known"]
exception increase   → ["exception", "allowlist", "exempt", "temporary"]
level decrease       → ["L<digit>", "level"]
```

These words are case-insensitive. A justification containing any one signal word for the
relevant change type passes semantic validation.

**Anti-gaming note:** The purpose of signal words is to encourage conscious acknowledgment,
not to create a bypass. Writing "intentional temporary known tradeoff" without explaining
the actual reasoning is a governance violation in spirit, even if it passes the check.
The check is a minimum bar, not a complete substitute for human review.

---

## Validation Hierarchy (B010 → B011)

```
B010 (syntax):  Has [BASELINE_CHANGE] tag?
                Has JUSTIFICATION: section?
                Has non-empty justification field?
                ↓ all pass
B011 (semantic): Does justification match change type?
                 Violation increase → causal signal word present?
                 Exception increase → exception signal word present?
                 Level decrease → level acknowledgment present?
```

Both layers must pass. B011 never runs without B010 passing first.

---

## Relationship to Other Principles

| Principle | Relationship |
|-----------|-------------|
| BASELINE_GOVERNANCE.md P2 (Justified) | B011 validates that the justification satisfies P2's intent, not just its form |
| CLOSURE_DRIFT.md P4 (Leakage Detection) | SR2 directly enforces leakage detection at the governance layer |
| P1 Enforcement > Documentation | Semantic validation is CI-enforced, not convention |
| P8 System > Human Discipline | The check replaces reliance on reviewers noticing inadequate justifications |

---

## History

- B011: initial definition, implemented as `check-baseline-semantic.mjs` + `baseline-semantic-rules.mjs`
