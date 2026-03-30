# Baseline Governance Principles

**Canonical definition.** Source of truth for Baseline Governance.
Consumer-facing behavioral guide: `~/.claude/rules/baseline-governance.md`
CI enforcement: `scripts/check-baseline-change.mjs` in jingu-agent

---

## Problem Statement

Drift detection (B009) can be bypassed:

```
system degrades → developer runs --record → CI passes → degradation hidden
```

This is the "governance gap": the system detects drift but cannot prevent the baseline from being
updated silently to absorb the drift. Baseline governance closes this gap.

---

## Core Insight

```
baseline ≠ configuration file
baseline = correctness contract
```

A baseline defines the system's minimum acceptable closure state. Changing the baseline
is not a routine operation — it is a declaration that the correctness contract has changed.

---

## Four Baseline Governance Principles

### P1 — Baseline Is a Contract

**Statement:** The closure baseline defines the minimum acceptable state of the system's correctness
properties. Any change to the baseline is a change to that contract, not a routine file update.

**Implication:**
- Baseline changes require the same review rigor as API contract changes
- Decreasing a baseline value (allowing more violations or exceptions) is a **regression declaration**
- Increasing a baseline value (fewer violations) is an improvement — allowed without special process

**Violation signal:** "I just ran `--record` to fix the CI" — this is treating the baseline as config,
not as contract.

**One-way ratchet rule:** baseline values should only move in the direction of improvement (fewer
violations, fewer exceptions). Movement in the degradation direction requires explicit justification.

---

### P2 — Baseline Update Must Be Justified

**Statement:** Any baseline change that relaxes a constraint (increases allowed violations or
exceptions) must include a written explanation of why the relaxation is acceptable.

**Required justification content:**
1. Why is this degradation acceptable? (not just "it was failing CI")
2. What invariant is intentionally relaxed?
3. What alternative was considered and rejected?
4. Is the closure level still at the target (L5)?

**Enforcement mechanism:** commit message must contain `[BASELINE_CHANGE]` tag and
`JUSTIFICATION:` section when `closure-baseline.json` is modified in a degrading direction.

**Violation signal:** `closure-baseline.json` changed without `[BASELINE_CHANGE]` tag in commit
message. CI fails via `check:baseline-change`.

---

### P3 — Baseline Change Must Be Observable

**Statement:** Any PR that modifies the closure baseline must make that fact explicitly visible —
in the commit message, in the PR description, and in CI output.

**Why:** Baseline changes are easy to hide in large PRs. If they are not flagged explicitly, reviewers
will miss them. An unobservable baseline change is effectively an unreviewed correctness contract change.

**Required signals:**
- Commit message: `[BASELINE_CHANGE]` tag
- CI check: `check:baseline-change` explicitly reports the change
- Journal: DECISION entry explaining the change

**Violation signal:** `closure-baseline.json` diff present in PR with no visible declaration.

---

### P4 — Stronger Gate Than Code Change

**Statement:** The approval bar for baseline changes must be higher than for ordinary code changes.
Ordinary code changes require: tests pass. Baseline changes require: tests pass AND justification
AND explicit declaration AND journal entry.

**Why:** A code change that introduces a bug will be caught by tests. A baseline change that hides
a bug bypasses tests — it retroactively makes the bug acceptable. This is a higher-severity action.

**Escalation protocol:**
1. Tests pass (necessary, not sufficient)
2. `check:closure-drift` shows drift being addressed
3. `[BASELINE_CHANGE]` + `JUSTIFICATION:` in commit message
4. Journal DECISION entry written first
5. `--record` run after all the above

**Violation signal:** Baseline updated without journal entry, or journal entry written after the fact.

---

## Baseline Metadata Schema

```json
{
  "closure_level": 5,
  "recorded_at": "<ISO 8601>",
  "justification": "<one-line summary of why this baseline was recorded>",
  "rules": {
    "R1": { "violations": 0, "exceptions": 1 },
    "R2": { "violations": 0, "exceptions": 0 },
    "R3": { "violations": 0, "exceptions": 0 },
    "R4": { "violations": 0, "exceptions": 0 },
    "R5": { "violations": 0, "exceptions": 0 }
  }
}
```

The `justification` field is required. `--record` must prompt for it.
If `justification` is empty or missing, `check:baseline-change` fails.

---

## Commit Message Format for Baseline Changes

```
[BASELINE_CHANGE] <short description>

JUSTIFICATION:
- Why is this change acceptable: <reason>
- Invariant relaxed: <which rule, why>
- Alternatives considered: <what else was tried>
- Closure level after change: L<N>

Ref: journal.md DECISION <date>
```

---

## One-Way Ratchet

The baseline enforces a one-way ratchet on closure quality:

```
improving changes (fewer violations/exceptions) → always allowed
degrading changes (more violations/exceptions) → requires full governance protocol
```

This means the system can become more closed over time, but never silently less closed.

---

## Relationship to Other Principles

| Principle | Relationship |
|-----------|-------------|
| CLOSURE_DRIFT.md P2 (Enforcement Reality) | Governance is the enforcement mechanism for the baseline itself |
| CLOSURE_DRIFT.md P3 (Stability Under Evolution) | Governance makes stability durable, not just monitored |
| P1 Enforcement > Documentation | The governance gate is CI-enforced, not convention-enforced |
| P8 System > Human Discipline | The [BASELINE_CHANGE] requirement is structural, not a reminder |

---

## History

- B010: initial definition, implemented as `check:baseline-change.mjs`
