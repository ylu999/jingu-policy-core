# Trace Semantics Principles

Machine-checkable statements of the five trace invariants. Each principle is implemented as a check function in `trace.ts`. Violation of any principle means the trace cannot be trusted for audit, replay, or governance.

---

## 1. Causal Completeness

Every event in a trace must trace back to exactly one root. The root event has no `parent_event_id` key (key absent — not null). Every non-root event must reference an existing event by `parent_event_id`.

**Violation consequence:** An incomplete causal chain cannot be replayed or audited. If the root is missing, there is no origin story. If a parent reference dangles, a segment of the trace is detached and unverifiable.

---

## 2. Semantic Precision

Every status value used in a trace must be drawn from the declared allowed set (`["pass", "fail", "skip"]` by default). Status values must not carry implicit or ambiguous meanings.

**Violation consequence:** An undeclared status value means the system has emitted a signal with no defined interpretation. Downstream consumers that branch on status will behave incorrectly or silently drop the event.

---

## 3. Measurement Correctness

Within each attempt group, duration measurements must be non-negative and monotonically non-decreasing. The first event in each attempt should baseline at `duration_ms === 0`.

**Violation consequence:** Negative or non-monotonic durations indicate clock errors, retroactive event insertion, or corrupted logs. Timing-based analysis (latency, SLA) produces wrong results.

---

## 4. Determinism Invariant

For a given input, the same execution must produce structurally equivalent traces (same event types, statuses, parent linkages, and attempt groupings at every position). This principle requires two traces to compare.

**Violation consequence:** Non-deterministic traces mean the system's behavior is unpredictable. Retries may produce different audit trails for the same logical operation, making root cause analysis unreliable.

---

## 5. Reconstructability

A stored trace must contain enough information to fully reconstruct what happened. This is a composite check: causal completeness + measurement correctness + non-empty payloads + `final_verdict` as last event.

**Violation consequence:** A trace without payloads is a skeleton — the structure is present but the content is lost. A `final_verdict` that is not last means the trace was extended after the decision was made, making the audit trail misleading.
