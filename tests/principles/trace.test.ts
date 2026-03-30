// tests/principles/trace.test.ts
// Unit tests for the 5 machine-checkable trace principles

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  checkCausalCompleteness,
  checkSemanticPrecision,
  checkMeasurementCorrectness,
  checkDeterminismInvariant,
  checkReconstructability,
  checkAllTracePrinciples,
  normalizeTrace,
  type NormalizedEvent,
} from "../../src/principles/trace.js"
import { InvariantCodes } from "../../src/invariants/codes.js"

// ---------------------------------------------------------------------------
// checkCausalCompleteness
// ---------------------------------------------------------------------------

describe("checkCausalCompleteness", () => {
  it("passes for a single root-only event", () => {
    const events = [{ event_id: "e1", type: "start" }]
    const result = checkCausalCompleteness(events)
    assert.equal(result.ok, true)
    assert.deepEqual(result.failures, [])
  })

  it("passes for a valid multi-event chain", () => {
    const events = [
      { event_id: "e1", type: "start" },
      { event_id: "e2", parent_event_id: "e1", type: "step" },
      { event_id: "e3", parent_event_id: "e2", type: "end" },
    ]
    const result = checkCausalCompleteness(events)
    assert.equal(result.ok, true)
  })

  it("fails with CAUSAL_ROOT_MISSING when all events have parent_event_id", () => {
    const events = [
      { event_id: "e1", parent_event_id: "e0", type: "step" },
      { event_id: "e2", parent_event_id: "e1", type: "end" },
    ]
    const result = checkCausalCompleteness(events)
    assert.equal(result.ok, false)
    assert.ok(result.failures.some(f => f.code === InvariantCodes.CAUSAL_ROOT_MISSING))
  })

  it("fails with CAUSAL_MULTIPLE_ROOTS when more than one root exists", () => {
    const events = [
      { event_id: "e1", type: "start" },
      { event_id: "e2", type: "start" },
      { event_id: "e3", parent_event_id: "e1", type: "step" },
    ]
    const result = checkCausalCompleteness(events)
    assert.equal(result.ok, false)
    assert.ok(result.failures.some(f => f.code === InvariantCodes.CAUSAL_MULTIPLE_ROOTS))
  })

  it("fails with CAUSAL_NULL_ROOT when parent_event_id key is present but value is null", () => {
    const events = [
      { event_id: "e1", type: "start" },
      { event_id: "e2", parent_event_id: null, type: "step" },
    ]
    const result = checkCausalCompleteness(events)
    assert.equal(result.ok, false)
    assert.ok(result.failures.some(f => f.code === InvariantCodes.CAUSAL_NULL_ROOT))
  })

  it("fails with CAUSAL_DANGLING_PARENT when parent_event_id references non-existent event", () => {
    const events = [
      { event_id: "e1", type: "start" },
      { event_id: "e2", parent_event_id: "e999", type: "step" },
    ]
    const result = checkCausalCompleteness(events)
    assert.equal(result.ok, false)
    const f = result.failures.find(f => f.code === InvariantCodes.CAUSAL_DANGLING_PARENT)
    assert.ok(f)
    assert.equal((f.details as Record<string, unknown>).dangling_id, "e2")
    assert.equal((f.details as Record<string, unknown>).referenced_parent, "e999")
  })
})

// ---------------------------------------------------------------------------
// checkSemanticPrecision
// ---------------------------------------------------------------------------

describe("checkSemanticPrecision", () => {
  it("passes when all status values are in the allowed set", () => {
    const result = checkSemanticPrecision(["pass", "fail", "pass"], ["pass", "fail", "skip"])
    assert.equal(result.ok, true)
  })

  it("fails with SEMANTIC_UNKNOWN_STATUS when an unknown status is used", () => {
    const result = checkSemanticPrecision(["pass", "error"], ["pass", "fail", "skip"])
    assert.equal(result.ok, false)
    const f = result.failures.find(f => f.code === InvariantCodes.SEMANTIC_UNKNOWN_STATUS)
    assert.ok(f)
    assert.equal((f.details as Record<string, unknown>).unknown_status, "error")
  })

  it("passes for empty status values list", () => {
    const result = checkSemanticPrecision([], ["pass", "fail"])
    assert.equal(result.ok, true)
  })
})

// ---------------------------------------------------------------------------
// checkMeasurementCorrectness
// ---------------------------------------------------------------------------

describe("checkMeasurementCorrectness", () => {
  it("passes for valid monotonic events", () => {
    const events = [
      { type: "start", duration_ms: 0, attempt_id: "a1" },
      { type: "step", duration_ms: 10, attempt_id: "a1" },
      { type: "end", duration_ms: 20, attempt_id: "a1" },
    ]
    const result = checkMeasurementCorrectness(events)
    assert.equal(result.ok, true)
    assert.deepEqual(result.failures, [])
  })

  it("warns with MEASUREMENT_NONZERO_ROOT when first event has non-zero duration", () => {
    const events = [
      { type: "start", duration_ms: 5, attempt_id: "a1" },
      { type: "end", duration_ms: 10, attempt_id: "a1" },
    ]
    const result = checkMeasurementCorrectness(events)
    assert.equal(result.ok, true)  // warnings don't fail
    assert.ok(result.failures.some(f => f.code === InvariantCodes.MEASUREMENT_NONZERO_ROOT))
    assert.equal(result.failures.find(f => f.code === InvariantCodes.MEASUREMENT_NONZERO_ROOT)?.severity, "warning")
  })

  it("fails with MEASUREMENT_NEGATIVE_DURATION when duration_ms < 0", () => {
    const events = [
      { type: "start", duration_ms: 0, attempt_id: "a1" },
      { type: "end", duration_ms: -5, attempt_id: "a1" },
    ]
    const result = checkMeasurementCorrectness(events)
    assert.equal(result.ok, false)
    assert.ok(result.failures.some(f => f.code === InvariantCodes.MEASUREMENT_NEGATIVE_DURATION))
  })

  it("fails with MEASUREMENT_NONMONOTONIC when later event has lower duration", () => {
    const events = [
      { type: "start", duration_ms: 0, attempt_id: "a1" },
      { type: "step", duration_ms: 20, attempt_id: "a1" },
      { type: "end", duration_ms: 10, attempt_id: "a1" },
    ]
    const result = checkMeasurementCorrectness(events)
    assert.equal(result.ok, false)
    assert.ok(result.failures.some(f => f.code === InvariantCodes.MEASUREMENT_NONMONOTONIC))
  })

  it("handles multiple attempt_id groups independently", () => {
    const events = [
      { type: "start", duration_ms: 0, attempt_id: "a1" },
      { type: "end", duration_ms: 10, attempt_id: "a1" },
      { type: "start", duration_ms: 0, attempt_id: "a2" },
      { type: "end", duration_ms: 5, attempt_id: "a2" },
    ]
    const result = checkMeasurementCorrectness(events)
    assert.equal(result.ok, true)
  })
})

// ---------------------------------------------------------------------------
// checkDeterminismInvariant
// ---------------------------------------------------------------------------

describe("checkDeterminismInvariant", () => {
  it("passes for identical traces", () => {
    const trace: NormalizedEvent[] = [
      { type: "start", status: "pass", attempt_id: "a1", parent_index: null },
      { type: "end", status: "pass", attempt_id: "a1", parent_index: 0 },
    ]
    const result = checkDeterminismInvariant(trace, [...trace.map(e => ({ ...e }))])
    assert.equal(result.ok, true)
  })

  it("fails with DETERMINISM_LENGTH_MISMATCH when traces have different lengths", () => {
    const a: NormalizedEvent[] = [{ type: "start", status: "pass", attempt_id: "a1", parent_index: null }]
    const b: NormalizedEvent[] = [
      { type: "start", status: "pass", attempt_id: "a1", parent_index: null },
      { type: "end", status: "pass", attempt_id: "a1", parent_index: 0 },
    ]
    const result = checkDeterminismInvariant(a, b)
    assert.equal(result.ok, false)
    const f = result.failures.find(f => f.code === InvariantCodes.DETERMINISM_LENGTH_MISMATCH)
    assert.ok(f)
    assert.equal((f.details as Record<string, unknown>).length_a, 1)
    assert.equal((f.details as Record<string, unknown>).length_b, 2)
  })

  it("fails with DETERMINISM_TYPE_MISMATCH when type differs at position 0", () => {
    const a: NormalizedEvent[] = [{ type: "start", status: "pass", attempt_id: "a1", parent_index: null }]
    const b: NormalizedEvent[] = [{ type: "init", status: "pass", attempt_id: "a1", parent_index: null }]
    const result = checkDeterminismInvariant(a, b)
    assert.equal(result.ok, false)
    const f = result.failures.find(f => f.code === InvariantCodes.DETERMINISM_TYPE_MISMATCH)
    assert.ok(f)
    assert.equal((f.details as Record<string, unknown>).position, 0)
  })

  it("fails with DETERMINISM_STATUS_MISMATCH when status differs", () => {
    const a: NormalizedEvent[] = [{ type: "end", status: "pass", attempt_id: "a1", parent_index: null }]
    const b: NormalizedEvent[] = [{ type: "end", status: "fail", attempt_id: "a1", parent_index: null }]
    const result = checkDeterminismInvariant(a, b)
    assert.equal(result.ok, false)
    assert.ok(result.failures.some(f => f.code === InvariantCodes.DETERMINISM_STATUS_MISMATCH))
  })

  it("fails with DETERMINISM_PARENT_MISMATCH when parent_index differs", () => {
    const a: NormalizedEvent[] = [
      { type: "root", status: "pass", attempt_id: "a1", parent_index: null },
      { type: "child", status: "pass", attempt_id: "a1", parent_index: 0 },
    ]
    const b: NormalizedEvent[] = [
      { type: "root", status: "pass", attempt_id: "a1", parent_index: null },
      { type: "child", status: "pass", attempt_id: "a1", parent_index: null },
    ]
    const result = checkDeterminismInvariant(a, b)
    assert.equal(result.ok, false)
    assert.ok(result.failures.some(f => f.code === InvariantCodes.DETERMINISM_PARENT_MISMATCH))
  })

  it("fails with DETERMINISM_GROUPING_MISMATCH when attempt_id sets differ", () => {
    const a: NormalizedEvent[] = [
      { type: "start", status: "pass", attempt_id: "a1", parent_index: null },
    ]
    const b: NormalizedEvent[] = [
      { type: "start", status: "pass", attempt_id: "a2", parent_index: null },
    ]
    const result = checkDeterminismInvariant(a, b)
    assert.equal(result.ok, false)
    assert.ok(result.failures.some(f => f.code === InvariantCodes.DETERMINISM_GROUPING_MISMATCH))
  })
})

// ---------------------------------------------------------------------------
// checkReconstructability
// ---------------------------------------------------------------------------

const validEvent = {
  event_id: "e1",
  type: "start",
  status: "pass",
  duration_ms: 0,
  attempt_id: "a1",
  payload: { task: "demo" },
}

describe("checkReconstructability", () => {
  it("passes for a full valid trace", () => {
    const events = [
      { event_id: "e1", type: "start", status: "pass", duration_ms: 0, attempt_id: "a1", payload: { task: "demo" } },
      { event_id: "e2", parent_event_id: "e1", type: "step", status: "pass", duration_ms: 10, attempt_id: "a1", payload: { action: "run" } },
      { event_id: "e3", parent_event_id: "e2", type: "final_verdict", status: "pass", duration_ms: 20, attempt_id: "a1", payload: { verdict: "pass" } },
    ]
    const result = checkReconstructability(events)
    assert.equal(result.ok, true)
  })

  it("fails with RECONSTRUCTABILITY_EMPTY_PAYLOAD when an event has an empty payload", () => {
    const events = [
      { event_id: "e1", type: "start", status: "pass", duration_ms: 0, attempt_id: "a1", payload: {} },
      { event_id: "e2", parent_event_id: "e1", type: "end", status: "pass", duration_ms: 10, attempt_id: "a1", payload: { x: 1 } },
    ]
    const result = checkReconstructability(events)
    assert.equal(result.ok, false)
    assert.ok(result.failures.some(f => f.code === InvariantCodes.RECONSTRUCTABILITY_EMPTY_PAYLOAD))
  })

  it("fails with RECONSTRUCTABILITY_VERDICT_NOT_LAST when final_verdict is not the last event", () => {
    const events = [
      { event_id: "e1", type: "start", status: "pass", duration_ms: 0, attempt_id: "a1", payload: { x: 1 } },
      { event_id: "e2", parent_event_id: "e1", type: "final_verdict", status: "pass", duration_ms: 5, attempt_id: "a1", payload: { v: 1 } },
      { event_id: "e3", parent_event_id: "e2", type: "cleanup", status: "pass", duration_ms: 10, attempt_id: "a1", payload: { c: 1 } },
    ]
    const result = checkReconstructability(events)
    assert.equal(result.ok, false)
    assert.ok(result.failures.some(f => f.code === InvariantCodes.RECONSTRUCTABILITY_VERDICT_NOT_LAST))
  })

  it("propagates CAUSAL_ROOT_MISSING from sub-check", () => {
    const events = [
      { event_id: "e1", parent_event_id: "missing", type: "start", status: "pass", duration_ms: 0, attempt_id: "a1", payload: { x: 1 } },
    ]
    const result = checkReconstructability(events)
    assert.equal(result.ok, false)
    assert.ok(result.failures.some(f => f.code === InvariantCodes.CAUSAL_ROOT_MISSING))
  })
})

// ---------------------------------------------------------------------------
// checkAllTracePrinciples
// ---------------------------------------------------------------------------

describe("checkAllTracePrinciples", () => {
  it("passes for a valid trace with default allowed statuses", () => {
    const events = [
      { event_id: "e1", type: "start", status: "pass", duration_ms: 0, attempt_id: "a1", payload: { x: 1 } },
      { event_id: "e2", parent_event_id: "e1", type: "final_verdict", status: "pass", duration_ms: 10, attempt_id: "a1", payload: { v: 1 } },
    ]
    const result = checkAllTracePrinciples(events)
    assert.equal(result.ok, true)
  })

  it("merges all failures for a trace with multiple violations", () => {
    const events = [
      // root missing (all have parent_event_id)
      { event_id: "e1", parent_event_id: "e0", type: "step", status: "unknown_status", duration_ms: -1, attempt_id: "a1", payload: {} },
    ]
    const result = checkAllTracePrinciples(events)
    assert.equal(result.ok, false)
    const codes = result.failures.map(f => f.code)
    // Should include causal, semantic, measurement, and reconstructability failures
    assert.ok(codes.includes(InvariantCodes.CAUSAL_ROOT_MISSING))
    assert.ok(codes.includes(InvariantCodes.SEMANTIC_UNKNOWN_STATUS))
    assert.ok(codes.includes(InvariantCodes.MEASUREMENT_NEGATIVE_DURATION))
    assert.ok(codes.includes(InvariantCodes.RECONSTRUCTABILITY_EMPTY_PAYLOAD))
  })

  it("respects custom allowedStatuses option", () => {
    const events = [
      { event_id: "e1", type: "start", status: "running", duration_ms: 0, attempt_id: "a1", payload: { x: 1 } },
      { event_id: "e2", parent_event_id: "e1", type: "final_verdict", status: "done", duration_ms: 5, attempt_id: "a1", payload: { v: 1 } },
    ]
    const result = checkAllTracePrinciples(events, { allowedStatuses: ["running", "done"] })
    assert.equal(result.ok, true)
  })
})

// ---------------------------------------------------------------------------
// normalizeTrace
// ---------------------------------------------------------------------------

describe("normalizeTrace", () => {
  it("assigns parent_index null for root events", () => {
    const events = [
      { event_id: "e1", type: "start", status: "pass", attempt_id: "a1" },
    ]
    const normalized = normalizeTrace(events)
    assert.equal(normalized[0].parent_index, null)
  })

  it("assigns correct parent_index for child events", () => {
    const events = [
      { event_id: "e1", type: "start", status: "pass", attempt_id: "a1" },
      { event_id: "e2", parent_event_id: "e1", type: "step", status: "pass", attempt_id: "a1" },
      { event_id: "e3", parent_event_id: "e2", type: "end", status: "pass", attempt_id: "a1" },
    ]
    const normalized = normalizeTrace(events)
    assert.equal(normalized[0].parent_index, null)
    assert.equal(normalized[1].parent_index, 0)
    assert.equal(normalized[2].parent_index, 1)
  })

  it("strips event_id from normalized output", () => {
    const events = [
      { event_id: "e1", type: "start", status: "pass", attempt_id: "a1" },
    ]
    const normalized = normalizeTrace(events)
    assert.ok(!("event_id" in normalized[0]))
  })
})
