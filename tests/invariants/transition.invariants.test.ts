// tests/invariants/transition.invariants.test.ts
// Unit: transition invariant functions

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  checkTransitionHasVerify,
  checkVerifyIsEvidenceBased,
  checkTransitionAdvanceAllowed,
  checkStateMutationIsBackedByTransition,
} from "../../src/invariants/transition.invariants.js"
import { InvariantCodes } from "../../src/invariants/codes.js"

describe("checkTransitionHasVerify", () => {
  it("passes when verify is present", () => {
    const result = checkTransitionHasVerify({ verify: { evidence_kind: "test_run" } })
    assert.equal(result.ok, true)
    assert.deepEqual(result.failures, [])
  })

  it("fails with MISSING_VERIFY when verify is absent", () => {
    const result = checkTransitionHasVerify({})
    assert.equal(result.ok, false)
    assert.equal(result.failures[0].code, InvariantCodes.MISSING_VERIFY)
    assert.equal(result.failures[0].severity, "error")
  })

  it("fails when verify is explicitly undefined", () => {
    const result = checkTransitionHasVerify({ verify: undefined })
    assert.equal(result.ok, false)
    assert.equal(result.failures[0].code, InvariantCodes.MISSING_VERIFY)
  })
})

describe("checkVerifyIsEvidenceBased", () => {
  it("passes when evidence_kind is present", () => {
    const result = checkVerifyIsEvidenceBased({ evidence_kind: "test_run" })
    assert.equal(result.ok, true)
  })

  it("fails with VERIFY_NOT_EVIDENCE_BASED when evidence_kind is absent", () => {
    const result = checkVerifyIsEvidenceBased({})
    assert.equal(result.ok, false)
    assert.equal(result.failures[0].code, InvariantCodes.VERIFY_NOT_EVIDENCE_BASED)
    assert.equal(result.failures[0].severity, "error")
  })

  it("fails when evidence_kind is explicitly undefined", () => {
    const result = checkVerifyIsEvidenceBased({ evidence_kind: undefined })
    assert.equal(result.ok, false)
    assert.equal(result.failures[0].code, InvariantCodes.VERIFY_NOT_EVIDENCE_BASED)
  })
})

describe("checkTransitionAdvanceAllowed", () => {
  it("passes when verify passed and state change attempted", () => {
    const result = checkTransitionAdvanceAllowed({ verify_passed: true, attempted_state_change: true })
    assert.equal(result.ok, true)
  })

  it("passes when no state change attempted regardless of verify", () => {
    const result = checkTransitionAdvanceAllowed({ verify_passed: false, attempted_state_change: false })
    assert.equal(result.ok, true)
  })

  it("fails with TRANSITION_WITHOUT_PASSING_VERIFY when state change attempted without passing verify", () => {
    const result = checkTransitionAdvanceAllowed({ verify_passed: false, attempted_state_change: true })
    assert.equal(result.ok, false)
    assert.equal(result.failures[0].code, InvariantCodes.TRANSITION_WITHOUT_PASSING_VERIFY)
    assert.equal(result.failures[0].severity, "error")
  })
})

describe("checkStateMutationIsBackedByTransition", () => {
  it("passes when state changed and transition record exists", () => {
    const result = checkStateMutationIsBackedByTransition({ state_changed: true, has_transition_record: true })
    assert.equal(result.ok, true)
  })

  it("passes when state did not change", () => {
    const result = checkStateMutationIsBackedByTransition({ state_changed: false, has_transition_record: false })
    assert.equal(result.ok, true)
  })

  it("fails with STATE_CHANGED_WITHOUT_TRANSITION when state changed but no record", () => {
    const result = checkStateMutationIsBackedByTransition({ state_changed: true, has_transition_record: false })
    assert.equal(result.ok, false)
    assert.equal(result.failures[0].code, InvariantCodes.STATE_CHANGED_WITHOUT_TRANSITION)
    assert.equal(result.failures[0].severity, "error")
  })
})
