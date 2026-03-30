// tests/invariants/multi-agent.invariants.test.ts
// Unit: multi-agent invariant functions

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  checkCandidateCannotWriteCanonicalState,
  checkMergedResultWasReverified,
} from "../../src/invariants/multi-agent.invariants.js"
import { InvariantCodes } from "../../src/invariants/codes.js"

describe("checkCandidateCannotWriteCanonicalState", () => {
  it("passes when orchestrator writes canonical state", () => {
    const result = checkCandidateCannotWriteCanonicalState({
      actor_kind: "orchestrator",
      attempted_canonical_write: true,
    })
    assert.equal(result.ok, true)
  })

  it("passes when candidate does not write canonical state", () => {
    const result = checkCandidateCannotWriteCanonicalState({
      actor_kind: "candidate",
      attempted_canonical_write: false,
    })
    assert.equal(result.ok, true)
  })

  it("fails with CANDIDATE_WRITES_CANONICAL_STATE when candidate attempts canonical write", () => {
    const result = checkCandidateCannotWriteCanonicalState({
      actor_kind: "candidate",
      attempted_canonical_write: true,
    })
    assert.equal(result.ok, false)
    assert.equal(result.failures[0].code, InvariantCodes.CANDIDATE_WRITES_CANONICAL_STATE)
    assert.equal(result.failures[0].severity, "error")
  })
})

describe("checkMergedResultWasReverified", () => {
  it("passes when merged and verify passed", () => {
    const result = checkMergedResultWasReverified({ merged: true, merged_verify_passed: true })
    assert.equal(result.ok, true)
  })

  it("passes when not merged (verify value irrelevant)", () => {
    const notMergedPass = checkMergedResultWasReverified({ merged: false, merged_verify_passed: true })
    assert.equal(notMergedPass.ok, true)

    const notMergedFail = checkMergedResultWasReverified({ merged: false, merged_verify_passed: false })
    assert.equal(notMergedFail.ok, true)
  })

  it("fails with MERGED_RESULT_NOT_REVERIFIED when merged but verify not passed", () => {
    const result = checkMergedResultWasReverified({ merged: true, merged_verify_passed: false })
    assert.equal(result.ok, false)
    assert.equal(result.failures[0].code, InvariantCodes.MERGED_RESULT_NOT_REVERIFIED)
    assert.equal(result.failures[0].severity, "error")
  })
})
