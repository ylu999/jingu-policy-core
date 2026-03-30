// tests/loop-events/loop-event-types.test.ts
// Unit: LoopEvent types — type vocabulary, shapes, EventSink, noopEventSink

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  noopEventSink,
  type LoopEventType,
  type LoopEventBase,
  type LoopEvent,
  type EventSink,
  type AttemptStartedPayload,
  type RppSchemaCheckedPayload,
  type RppBindingCheckedPayload,
  type RppStrictnessCheckedPayload,
  type ReviewerEvaluatedPayload,
  type RetryRequestedPayload,
  type FinalVerdictPayload,
} from "../../src/loop-events/types.js"

// ---------------------------------------------------------------------------
// All 7 LoopEventType values exist and are correct strings
// ---------------------------------------------------------------------------
describe("LoopEventType — all 7 values", () => {
  it("type values are the expected string literals", () => {
    const values: LoopEventType[] = [
      "attempt_started",
      "rpp_schema_checked",
      "rpp_binding_checked",
      "rpp_strictness_checked",
      "reviewer_evaluated",
      "retry_requested",
      "final_verdict",
    ]
    assert.equal(values.length, 7)
    assert.equal(values[0], "attempt_started")
    assert.equal(values[1], "rpp_schema_checked")
    assert.equal(values[2], "rpp_binding_checked")
    assert.equal(values[3], "rpp_strictness_checked")
    assert.equal(values[4], "reviewer_evaluated")
    assert.equal(values[5], "retry_requested")
    assert.equal(values[6], "final_verdict")
  })
})

// ---------------------------------------------------------------------------
// LoopEventBase shape — required fields + optional parent_event_id
// ---------------------------------------------------------------------------
describe("LoopEventBase shape", () => {
  it("accepts a valid base event with all required fields", () => {
    const base: LoopEventBase = {
      event_id: "evt-001",
      run_id: "run-001",
      attempt_id: "run-001-a1",
      type: "attempt_started",
      timestamp: "2024-01-01T00:00:00.000Z",
      status: "pass",
      duration_ms: 0,
      payload: {},
    }
    assert.equal(base.event_id, "evt-001")
    assert.equal(base.run_id, "run-001")
    assert.equal(base.attempt_id, "run-001-a1")
    assert.equal(base.type, "attempt_started")
    assert.equal(base.timestamp, "2024-01-01T00:00:00.000Z")
    assert.equal(base.status, "pass")
    assert.equal(base.duration_ms, 0)
    assert.deepEqual(base.payload, {})
  })

  it("parent_event_id is optional — can be omitted for root events", () => {
    const base: LoopEventBase = {
      event_id: "evt-001",
      run_id: "run-001",
      attempt_id: "run-001-a1",
      type: "attempt_started",
      timestamp: "2024-01-01T00:00:00.000Z",
      status: "pass",
      duration_ms: 0,
      payload: {},
    }
    // parent_event_id is absent — TypeScript allows this (it is ?string)
    assert.equal(base.parent_event_id, undefined)
  })

  it("parent_event_id can be set for non-root events", () => {
    const base: LoopEventBase = {
      event_id: "evt-002",
      run_id: "run-001",
      attempt_id: "run-001-a1",
      parent_event_id: "evt-001",
      type: "rpp_schema_checked",
      timestamp: "2024-01-01T00:00:00.100Z",
      status: "pass",
      duration_ms: 100,
      payload: {},
    }
    assert.equal(base.parent_event_id, "evt-001")
  })

  it("duration_ms is required and is a number (not optional)", () => {
    const base: LoopEventBase = {
      event_id: "evt-001",
      run_id: "run-001",
      attempt_id: "run-001-a1",
      type: "attempt_started",
      timestamp: "2024-01-01T00:00:00.000Z",
      status: "pass",
      duration_ms: 0,
      payload: {},
    }
    // duration_ms must be present and is a number
    assert.equal(typeof base.duration_ms, "number")
    assert.equal(base.duration_ms, 0)
  })
})

// ---------------------------------------------------------------------------
// status accepts exactly "pass" | "fail" | "skip"
// ---------------------------------------------------------------------------
describe("status field", () => {
  it("accepts pass", () => {
    const base: LoopEventBase = {
      event_id: "e1", run_id: "r1", attempt_id: "r1-a1",
      type: "attempt_started", timestamp: "2024-01-01T00:00:00Z",
      status: "pass", duration_ms: 0, payload: {},
    }
    assert.equal(base.status, "pass")
  })

  it("accepts fail", () => {
    const base: LoopEventBase = {
      event_id: "e1", run_id: "r1", attempt_id: "r1-a1",
      type: "final_verdict", timestamp: "2024-01-01T00:00:00Z",
      status: "fail", duration_ms: 500, payload: {},
    }
    assert.equal(base.status, "fail")
  })

  it("accepts skip — gate not applicable due to prior failure short-circuit", () => {
    const base: LoopEventBase = {
      event_id: "e1", run_id: "r1", attempt_id: "r1-a1",
      type: "rpp_binding_checked", timestamp: "2024-01-01T00:00:00Z",
      status: "skip", duration_ms: 10, payload: {},
    }
    assert.equal(base.status, "skip")
  })
})

// ---------------------------------------------------------------------------
// EventSink interface — emit required, flush optional
// ---------------------------------------------------------------------------
describe("EventSink interface", () => {
  it("emit is required on EventSink", () => {
    const sink: EventSink = {
      emit(_e: LoopEvent) {},
    }
    assert.equal(typeof sink.emit, "function")
  })

  it("flush is optional on EventSink", () => {
    const sinkWithFlush: EventSink = {
      emit(_e: LoopEvent) {},
      flush: () => Promise.resolve(),
    }
    assert.equal(typeof sinkWithFlush.flush, "function")

    const sinkWithoutFlush: EventSink = {
      emit(_e: LoopEvent) {},
    }
    assert.equal(sinkWithoutFlush.flush, undefined)
  })
})

// ---------------------------------------------------------------------------
// noopEventSink — emit and flush do nothing and do not throw
// ---------------------------------------------------------------------------
describe("noopEventSink", () => {
  const makeAttemptStartedEvent = (): LoopEvent => ({
    event_id: "evt-001",
    run_id: "run-001",
    attempt_id: "run-001-a1",
    type: "attempt_started",
    timestamp: "2024-01-01T00:00:00.000Z",
    status: "pass",
    duration_ms: 0,
    payload: { attempt: 1, max_attempts: 3 },
  })

  it("emit() accepts any LoopEvent without throwing", () => {
    assert.doesNotThrow(() => noopEventSink.emit(makeAttemptStartedEvent()))
  })

  it("emit() with final_verdict event does not throw", () => {
    const event: LoopEvent = {
      event_id: "evt-007",
      run_id: "run-001",
      attempt_id: "run-001-a1",
      parent_event_id: "evt-006",
      type: "final_verdict",
      timestamp: "2024-01-01T00:00:01.000Z",
      status: "pass",
      duration_ms: 1000,
      payload: { verdict: "pass", reason: "all checks passed", total_attempts: 1 },
    }
    assert.doesNotThrow(() => noopEventSink.emit(event))
  })

  it("flush() resolves to void without throwing", async () => {
    const result = await noopEventSink.flush!()
    assert.equal(result, undefined)
  })

  it("noopEventSink is a const object (not a class instance)", () => {
    assert.notEqual(typeof noopEventSink, "function")
    assert.equal(typeof noopEventSink, "object")
    assert.equal(typeof noopEventSink.emit, "function")
    assert.equal(typeof noopEventSink.flush, "function")
  })
})

// ---------------------------------------------------------------------------
// LoopEvent discriminated union — each type maps to correct payload shape
// ---------------------------------------------------------------------------
describe("LoopEvent discriminated union payload types", () => {
  it("attempt_started payload has attempt and max_attempts", () => {
    const event: LoopEvent = {
      event_id: "e1", run_id: "r1", attempt_id: "r1-a1",
      type: "attempt_started",
      timestamp: "2024-01-01T00:00:00Z",
      status: "pass", duration_ms: 0,
      payload: { attempt: 1, max_attempts: 3 },
    }
    if (event.type === "attempt_started") {
      const p: AttemptStartedPayload = event.payload
      assert.equal(p.attempt, 1)
      assert.equal(p.max_attempts, 3)
    }
  })

  it("rpp_schema_checked payload has valid and optional error_code", () => {
    const event: LoopEvent = {
      event_id: "e2", run_id: "r1", attempt_id: "r1-a1",
      parent_event_id: "e1",
      type: "rpp_schema_checked",
      timestamp: "2024-01-01T00:00:00.010Z",
      status: "pass", duration_ms: 10,
      payload: { valid: true },
    }
    if (event.type === "rpp_schema_checked") {
      const p: RppSchemaCheckedPayload = event.payload
      assert.equal(p.valid, true)
      assert.equal(p.error_code, undefined)
    }
  })

  it("rpp_binding_checked payload has binding_valid, error_codes, checked_refs, unbound_refs", () => {
    const event: LoopEvent = {
      event_id: "e3", run_id: "r1", attempt_id: "r1-a1",
      parent_event_id: "e2",
      type: "rpp_binding_checked",
      timestamp: "2024-01-01T00:00:00.020Z",
      status: "fail", duration_ms: 20,
      payload: { binding_valid: false, error_codes: ["UNBOUND_REF"], checked_refs: 5, unbound_refs: 1 },
    }
    if (event.type === "rpp_binding_checked") {
      const p: RppBindingCheckedPayload = event.payload
      assert.equal(p.binding_valid, false)
      assert.ok(p.error_codes.includes("UNBOUND_REF"))
      assert.equal(p.checked_refs, 5)
      assert.equal(p.unbound_refs, 1)
    }
  })

  it("rpp_strictness_checked payload has strictness_pass and warning_codes", () => {
    const event: LoopEvent = {
      event_id: "e4", run_id: "r1", attempt_id: "r1-a1",
      parent_event_id: "e3",
      type: "rpp_strictness_checked",
      timestamp: "2024-01-01T00:00:00.030Z",
      status: "pass", duration_ms: 30,
      payload: { strictness_pass: true, warning_codes: [] },
    }
    if (event.type === "rpp_strictness_checked") {
      const p: RppStrictnessCheckedPayload = event.payload
      assert.equal(p.strictness_pass, true)
      assert.equal(p.warning_codes.length, 0)
    }
  })

  it("reviewer_evaluated payload has verdict and issues", () => {
    const event: LoopEvent = {
      event_id: "e5", run_id: "r1", attempt_id: "r1-a1",
      parent_event_id: "e4",
      type: "reviewer_evaluated",
      timestamp: "2024-01-01T00:00:00.040Z",
      status: "pass", duration_ms: 40,
      payload: { verdict: "pass", issues: [] },
    }
    if (event.type === "reviewer_evaluated") {
      const p: ReviewerEvaluatedPayload = event.payload
      assert.equal(p.verdict, "pass")
      assert.equal(p.issues.length, 0)
    }
  })

  it("retry_requested payload has attempt, reason, recoverable, binding_error_codes", () => {
    const event: LoopEvent = {
      event_id: "e6", run_id: "r1", attempt_id: "r1-a1",
      parent_event_id: "e5",
      type: "retry_requested",
      timestamp: "2024-01-01T00:00:00.050Z",
      status: "fail", duration_ms: 50,
      payload: { attempt: 1, reason: "binding failed", recoverable: true, binding_error_codes: ["UNBOUND_REF"] },
    }
    if (event.type === "retry_requested") {
      const p: RetryRequestedPayload = event.payload
      assert.equal(p.attempt, 1)
      assert.equal(p.reason, "binding failed")
      assert.equal(p.recoverable, true)
      assert.ok(p.binding_error_codes.includes("UNBOUND_REF"))
    }
  })

  it("final_verdict payload has verdict, reason, total_attempts", () => {
    const event: LoopEvent = {
      event_id: "e7", run_id: "r1", attempt_id: "r1-a1",
      parent_event_id: "e6",
      type: "final_verdict",
      timestamp: "2024-01-01T00:00:00.100Z",
      status: "pass", duration_ms: 100,
      payload: { verdict: "pass", reason: "all passed", total_attempts: 1 },
    }
    if (event.type === "final_verdict") {
      const p: FinalVerdictPayload = event.payload
      assert.equal(p.verdict, "pass")
      assert.equal(p.reason, "all passed")
      assert.equal(p.total_attempts, 1)
    }
  })
})
