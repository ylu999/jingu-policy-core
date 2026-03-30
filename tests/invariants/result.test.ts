// tests/invariants/result.test.ts
// Unit: InvariantCheckResult — pass(), fail(), mergeResults()

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { pass, fail, mergeResults, type InvariantFailure } from "../../src/invariants/result.js"

const errorFailure: InvariantFailure = {
  code: "TEST_ERROR",
  severity: "error",
  message: "test error",
}

const warningFailure: InvariantFailure = {
  code: "TEST_WARNING",
  severity: "warning",
  message: "test warning",
}

describe("pass()", () => {
  it("returns ok:true with empty failures", () => {
    const result = pass()
    assert.equal(result.ok, true)
    assert.deepEqual(result.failures, [])
  })
})

describe("fail()", () => {
  it("returns ok:false with provided failures", () => {
    const result = fail(errorFailure)
    assert.equal(result.ok, false)
    assert.equal(result.failures.length, 1)
    assert.equal(result.failures[0].code, "TEST_ERROR")
  })

  it("accepts multiple failures", () => {
    const result = fail(errorFailure, warningFailure)
    assert.equal(result.ok, false)
    assert.equal(result.failures.length, 2)
  })
})

describe("mergeResults()", () => {
  it("all pass → ok:true, no failures", () => {
    const result = mergeResults([pass(), pass()])
    assert.equal(result.ok, true)
    assert.deepEqual(result.failures, [])
  })

  it("pass + error fail → ok:false", () => {
    const result = mergeResults([pass(), fail(errorFailure)])
    assert.equal(result.ok, false)
    assert.equal(result.failures.length, 1)
  })

  it("warning-only fail → ok:true (warnings do not block)", () => {
    const result = mergeResults([pass(), fail(warningFailure)])
    assert.equal(result.ok, true)
    assert.equal(result.failures.length, 1)
    assert.equal(result.failures[0].severity, "warning")
  })

  it("empty array → ok:true, no failures", () => {
    const result = mergeResults([])
    assert.equal(result.ok, true)
    assert.deepEqual(result.failures, [])
  })

  it("error and warning together → ok:false, both failures present", () => {
    const result = mergeResults([fail(errorFailure), fail(warningFailure)])
    assert.equal(result.ok, false)
    assert.equal(result.failures.length, 2)
  })

  it("multiple error failures → all collected", () => {
    const error2: InvariantFailure = { code: "OTHER", severity: "error", message: "other" }
    const result = mergeResults([fail(errorFailure), fail(error2)])
    assert.equal(result.ok, false)
    assert.equal(result.failures.length, 2)
  })
})
