// tests/unit/cognition/validate-type-principal.test.ts
// p166: TYPE_PRINCIPAL_POLICY + validateTypePrincipal() tests

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { validateTypePrincipal } from "../../../src/cognition/validate-type-principal.js"

describe("validateTypePrincipal — root_cause_fix", () => {
  it("valid when required principal present", () => {
    const r = validateTypePrincipal("root_cause_fix", ["fix_cause_not_symptom"])
    assert.equal(r.valid, true)
    assert.equal(r.violations.length, 0)
  })

  it("valid when required + extra non-forbidden principals", () => {
    const r = validateTypePrincipal("root_cause_fix", ["fix_cause_not_symptom", "some_other"])
    assert.equal(r.valid, true)
  })

  it("forbidden: workaround_only", () => {
    const r = validateTypePrincipal("root_cause_fix", ["fix_cause_not_symptom", "workaround_only"])
    assert.equal(r.valid, false)
    assert.ok(r.violations.some((v) => v.kind === "has_forbidden" && v.principal === "workaround_only"))
  })

  it("forbidden: surface_pattern_match", () => {
    const r = validateTypePrincipal("root_cause_fix", ["fix_cause_not_symptom", "surface_pattern_match"])
    assert.equal(r.valid, false)
    assert.ok(r.violations.some((v) => v.kind === "has_forbidden" && v.principal === "surface_pattern_match"))
  })

  it("missing required when empty principals", () => {
    const r = validateTypePrincipal("root_cause_fix", [])
    assert.equal(r.valid, false)
    assert.ok(r.violations.some((v) => v.kind === "missing_required"))
  })

  it("missing required when no required principal in list", () => {
    const r = validateTypePrincipal("root_cause_fix", ["something_else"])
    assert.equal(r.valid, false)
    assert.ok(r.violations.some((v) => v.kind === "missing_required"))
  })

  it("both missing_required and has_forbidden when required absent and forbidden present", () => {
    // No fix_cause_not_symptom + has workaround_only
    const r = validateTypePrincipal("root_cause_fix", ["workaround_only"])
    assert.equal(r.valid, false)
    assert.ok(r.violations.some((v) => v.kind === "missing_required"))
    assert.ok(r.violations.some((v) => v.kind === "has_forbidden"))
  })
})

describe("validateTypePrincipal — workaround_fix", () => {
  it("valid with no principals (no required)", () => {
    const r = validateTypePrincipal("workaround_fix", [])
    assert.equal(r.valid, true)
  })

  it("valid with non-forbidden principals", () => {
    const r = validateTypePrincipal("workaround_fix", ["some_principal"])
    assert.equal(r.valid, true)
  })

  it("forbidden: fix_cause_not_symptom", () => {
    const r = validateTypePrincipal("workaround_fix", ["fix_cause_not_symptom"])
    assert.equal(r.valid, false)
    assert.ok(r.violations.some((v) => v.kind === "has_forbidden" && v.principal === "fix_cause_not_symptom"))
  })
})

describe("validateTypePrincipal — exploration", () => {
  it("valid with probe_until_signal", () => {
    const r = validateTypePrincipal("exploration", ["probe_until_signal"])
    assert.equal(r.valid, true)
  })

  it("missing required when no probe_until_signal", () => {
    const r = validateTypePrincipal("exploration", [])
    assert.equal(r.valid, false)
    assert.ok(r.violations.some((v) => v.kind === "missing_required"))
  })

  it("forbidden: apply_patch", () => {
    const r = validateTypePrincipal("exploration", ["probe_until_signal", "apply_patch"])
    assert.equal(r.valid, false)
    assert.ok(r.violations.some((v) => v.kind === "has_forbidden" && v.principal === "apply_patch"))
  })
})

describe("validateTypePrincipal — test_validation", () => {
  it("valid with verify_before_submit", () => {
    const r = validateTypePrincipal("test_validation", ["verify_before_submit"])
    assert.equal(r.valid, true)
  })

  it("missing required when no verify_before_submit", () => {
    const r = validateTypePrincipal("test_validation", [])
    assert.equal(r.valid, false)
  })
})

describe("validateTypePrincipal — environment_fix", () => {
  it("valid with fix_environment_first", () => {
    const r = validateTypePrincipal("environment_fix", ["fix_environment_first"])
    assert.equal(r.valid, true)
  })

  it("forbidden: fix_cause_not_symptom", () => {
    const r = validateTypePrincipal("environment_fix", ["fix_environment_first", "fix_cause_not_symptom"])
    assert.equal(r.valid, false)
    assert.ok(r.violations.some((v) => v.kind === "has_forbidden" && v.principal === "fix_cause_not_symptom"))
  })
})

describe("validateTypePrincipal — unknown type", () => {
  it("unknown type is unconstrained → valid", () => {
    const r = validateTypePrincipal("unknown_type_xyz", [])
    assert.equal(r.valid, true)
    assert.equal(r.violations.length, 0)
  })

  it("unknown type with any principals → valid", () => {
    const r = validateTypePrincipal("custom_reasoning", ["workaround_only", "fix_cause_not_symptom"])
    assert.equal(r.valid, true)
  })

  it("empty type string is unknown → valid", () => {
    const r = validateTypePrincipal("", ["something"])
    assert.equal(r.valid, true)
  })
})
