// tests/invariants/execution.invariants.test.ts
// Unit: execution invariant functions

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  checkExecutionHasObservableOutput,
  checkNoOpPolicy,
  checkScope,
  checkFailuresAreTyped,
  validateRuntimeExecution,
} from "../../src/invariants/execution.invariants.js"
import { InvariantCodes } from "../../src/invariants/codes.js"

describe("checkExecutionHasObservableOutput", () => {
  it("passes when expected_outputs is empty (no outputs declared)", () => {
    const result = checkExecutionHasObservableOutput({ expected_outputs: [], observed_outputs: [] })
    assert.equal(result.ok, true)
  })

  it("passes when expected non-empty and observed non-empty", () => {
    const result = checkExecutionHasObservableOutput({
      expected_outputs: ["dist/foo.js"],
      observed_outputs: ["dist/foo.js"],
    })
    assert.equal(result.ok, true)
  })

  it("fails with NO_OBSERVABLE_OUTPUT when expected non-empty but observed empty", () => {
    const result = checkExecutionHasObservableOutput({
      expected_outputs: ["dist/foo.js"],
      observed_outputs: [],
    })
    assert.equal(result.ok, false)
    assert.equal(result.failures[0].code, InvariantCodes.NO_OBSERVABLE_OUTPUT)
    assert.equal(result.failures[0].severity, "error")
  })
})

describe("checkNoOpPolicy", () => {
  it("passes when files were changed", () => {
    const result = checkNoOpPolicy({ changed_files_count: 3 })
    assert.equal(result.ok, true)
  })

  it("passes when no files changed but allow_no_op is true", () => {
    const result = checkNoOpPolicy({ changed_files_count: 0, allow_no_op: true })
    assert.equal(result.ok, true)
  })

  it("fails with NO_OP_FORBIDDEN when no files changed and allow_no_op is falsy", () => {
    const result = checkNoOpPolicy({ changed_files_count: 0 })
    assert.equal(result.ok, false)
    assert.equal(result.failures[0].code, InvariantCodes.NO_OP_FORBIDDEN)
    assert.equal(result.failures[0].severity, "error")
  })

  it("fails when allow_no_op is explicitly false", () => {
    const result = checkNoOpPolicy({ changed_files_count: 0, allow_no_op: false })
    assert.equal(result.ok, false)
    assert.equal(result.failures[0].code, InvariantCodes.NO_OP_FORBIDDEN)
  })
})

describe("checkScope", () => {
  it("passes when allowed_files is empty (open scope)", () => {
    const result = checkScope({ allowed_files: [], changed_files: ["src/anything.ts"] })
    assert.equal(result.ok, true)
  })

  it("passes when all changed files are within allowed scope", () => {
    const result = checkScope({
      allowed_files: ["src/foo.ts", "src/bar.ts"],
      changed_files: ["src/foo.ts"],
    })
    assert.equal(result.ok, true)
  })

  it("fails with SCOPE_VIOLATION when a changed file is outside allowed scope", () => {
    const result = checkScope({
      allowed_files: ["src/foo.ts"],
      changed_files: ["src/foo.ts", "src/secret.ts"],
    })
    assert.equal(result.ok, false)
    assert.equal(result.failures[0].code, InvariantCodes.SCOPE_VIOLATION)
    assert.equal(result.failures[0].severity, "error")
    assert.ok((result.failures[0].details as Record<string, unknown>)["illegal_paths"] != null)
  })

  it("fails when all changed files are outside scope", () => {
    const result = checkScope({
      allowed_files: ["src/allowed.ts"],
      changed_files: ["src/other.ts"],
    })
    assert.equal(result.ok, false)
    assert.equal(result.failures[0].code, InvariantCodes.SCOPE_VIOLATION)
  })
})

describe("checkFailuresAreTyped", () => {
  it("passes when all failures have a code", () => {
    const result = checkFailuresAreTyped({ failures: [{ code: "SOME_ERROR" }, { code: "OTHER_ERROR" }] })
    assert.equal(result.ok, true)
  })

  it("passes when failures array is empty", () => {
    const result = checkFailuresAreTyped({ failures: [] })
    assert.equal(result.ok, true)
  })

  it("fails with NON_TYPED_FAILURE when a failure is missing code", () => {
    const result = checkFailuresAreTyped({ failures: [{ code: "GOOD" }, {}] })
    assert.equal(result.ok, false)
    assert.equal(result.failures[0].code, InvariantCodes.NON_TYPED_FAILURE)
    assert.equal(result.failures[0].severity, "error")
  })
})

describe("validateRuntimeExecution", () => {
  it("passes with fully valid input", () => {
    const result = validateRuntimeExecution({
      expected_outputs: ["dist/foo.js"],
      observed_outputs: ["dist/foo.js"],
      changed_files_count: 1,
      allowed_files: ["src/foo.ts"],
      changed_files: ["src/foo.ts"],
      failures: [],
    })
    assert.equal(result.ok, true)
  })

  it("fails with SCOPE_VIOLATION when scope is violated", () => {
    const result = validateRuntimeExecution({
      expected_outputs: [],
      observed_outputs: [],
      changed_files_count: 1,
      allow_no_op: true,
      allowed_files: ["src/allowed.ts"],
      changed_files: ["src/forbidden.ts"],
      failures: [],
    })
    assert.equal(result.ok, false)
    const codes = result.failures.map(f => f.code)
    assert.ok(codes.includes(InvariantCodes.SCOPE_VIOLATION))
  })

  it("collects multiple failures when multiple invariants violated", () => {
    const result = validateRuntimeExecution({
      expected_outputs: ["dist/foo.js"],
      observed_outputs: [],
      changed_files_count: 0,
      allowed_files: ["src/allowed.ts"],
      changed_files: ["src/forbidden.ts"],
      failures: [{}],
    })
    assert.equal(result.ok, false)
    assert.ok(result.failures.length >= 2, `expected >= 2 failures, got ${result.failures.length}`)
  })
})
