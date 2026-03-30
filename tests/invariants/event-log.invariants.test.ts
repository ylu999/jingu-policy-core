// tests/invariants/event-log.invariants.test.ts
// Unit: event-log invariant functions

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  checkLoopEventHasAttemptId,
  checkLoopEventHasStatus,
  checkLoopEventSequence,
} from "../../src/invariants/event-log.invariants.js"
import { InvariantCodes } from "../../src/invariants/codes.js"

describe("checkLoopEventHasAttemptId", () => {
  it("passes when attempt_id is present", () => {
    const result = checkLoopEventHasAttemptId({ type: "rpp_schema_checked", attempt_id: "run-1-a1" })
    assert.equal(result.ok, true)
  })

  it("passes for final_verdict even without attempt_id", () => {
    const result = checkLoopEventHasAttemptId({ type: "final_verdict" })
    assert.equal(result.ok, true)
  })

  it("warns with MISSING_ATTEMPT_ID for non-final event missing attempt_id", () => {
    const result = checkLoopEventHasAttemptId({ type: "rpp_schema_checked" })
    // warning-only → ok:true per mergeResults semantics but direct fail() call → ok:false
    assert.equal(result.ok, false)
    assert.equal(result.failures[0].code, InvariantCodes.MISSING_ATTEMPT_ID)
    assert.equal(result.failures[0].severity, "warning")
  })

  it("warns for attempt_started missing attempt_id", () => {
    const result = checkLoopEventHasAttemptId({ type: "attempt_started" })
    assert.equal(result.failures[0].code, InvariantCodes.MISSING_ATTEMPT_ID)
    assert.equal(result.failures[0].severity, "warning")
  })
})

describe("checkLoopEventHasStatus", () => {
  it("passes when gate event has status", () => {
    const result = checkLoopEventHasStatus({ type: "rpp_schema_checked", status: "pass" })
    assert.equal(result.ok, true)
  })

  it("passes for non-gate events without status", () => {
    const result = checkLoopEventHasStatus({ type: "attempt_started" })
    assert.equal(result.ok, true)
  })

  it("warns with MISSING_EVENT_STATUS for gate event missing status", () => {
    const result = checkLoopEventHasStatus({ type: "rpp_schema_checked" })
    assert.equal(result.ok, false)
    assert.equal(result.failures[0].code, InvariantCodes.MISSING_EVENT_STATUS)
    assert.equal(result.failures[0].severity, "warning")
  })

  it("warns for reviewer_evaluated missing status", () => {
    const result = checkLoopEventHasStatus({ type: "reviewer_evaluated" })
    assert.equal(result.failures[0].code, InvariantCodes.MISSING_EVENT_STATUS)
  })
})

describe("checkLoopEventSequence", () => {
  it("passes for a valid event sequence", () => {
    const events = [
      { type: "attempt_started", attempt_id: "a1" },
      { type: "rpp_schema_checked", attempt_id: "a1" },
      { type: "retry_requested", attempt_id: "a1" },
      { type: "attempt_started", attempt_id: "a2" },
      { type: "rpp_schema_checked", attempt_id: "a2" },
      { type: "final_verdict" },
    ]
    const result = checkLoopEventSequence(events)
    assert.equal(result.ok, true)
  })

  it("passes for empty event list (replay test: write nothing → sequence valid)", () => {
    const result = checkLoopEventSequence([])
    assert.equal(result.ok, true)
  })

  it("fails with INVALID_EVENT_SEQUENCE when retry_requested before attempt_started", () => {
    const events = [
      { type: "retry_requested", attempt_id: "a1" },
      { type: "attempt_started", attempt_id: "a1" },
    ]
    const result = checkLoopEventSequence(events)
    assert.equal(result.ok, false)
    assert.equal(result.failures[0].code, InvariantCodes.INVALID_EVENT_SEQUENCE)
    assert.equal(result.failures[0].severity, "error")
  })

  it("fails when events reference an attempt_id with no attempt_started", () => {
    const events = [
      { type: "rpp_schema_checked", attempt_id: "a1" },
    ]
    const result = checkLoopEventSequence(events)
    assert.equal(result.ok, false)
    assert.equal(result.failures[0].code, InvariantCodes.INVALID_EVENT_SEQUENCE)
  })

  it("replay test: write events in order, read back, sequence passes", () => {
    // Simulate writing events to a log and reading them back
    const log: Array<{ type: string; attempt_id?: string }> = []
    log.push({ type: "attempt_started", attempt_id: "replay-a1" })
    log.push({ type: "rpp_schema_checked", attempt_id: "replay-a1" })
    log.push({ type: "final_verdict" })

    const result = checkLoopEventSequence(log)
    assert.equal(result.ok, true, `Expected ok:true for valid replay log, got failures: ${JSON.stringify(result.failures)}`)
  })
})
