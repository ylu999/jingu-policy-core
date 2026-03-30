// tests/brief/brief-builder.test.ts
// Unit 0.2: Brief Builder tests

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { buildBrief } from "../../src/brief/brief-builder.js"
import { ExecutionConfig, PolicyPack } from "../../src/resolver/policy-resolver.js"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GLOBAL_PACK: PolicyPack = {
  id: "global",
  policies: ["no_assumption_as_fact", "evidence_required_for_claims"],
  gates: ["evidence_required_gate", "verify_gate"],
  reviewer_checks: [],
}

const DESIGN_PACK: PolicyPack = {
  id: "design",
  policies: ["must_include_failure_model", "must_define_module_boundaries"],
  gates: ["design_completeness_gate", "scope_gate"],
  reviewer_checks: ["design_review_check"],
}

const HIGH_RISK_PACK: PolicyPack = {
  id: "high_risk",
  policies: ["reviewer_required", "rollback_plan_mandatory"],
  gates: ["rollback_gate"],
  reviewer_checks: ["pre_mortem_check"],
}

function makeConfig(overrides: Partial<ExecutionConfig> = {}): ExecutionConfig {
  return {
    active_packs: [GLOBAL_PACK, DESIGN_PACK],
    required_gates: ["evidence_required_gate", "verify_gate", "design_completeness_gate", "scope_gate"],
    reviewer_mode: "optional",
    execution_mode: "single",
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("buildBrief — happy path", () => {
  it("returns a string", () => {
    const result = buildBrief(makeConfig())
    assert.equal(typeof result, "string")
  })

  it("output contains all 3 section headers", () => {
    const result = buildBrief(makeConfig())
    assert.ok(result.includes("## ACTIVE POLICIES"), "missing ACTIVE POLICIES header")
    assert.ok(result.includes("## REQUIRED GATES"), "missing REQUIRED GATES header")
    assert.ok(result.includes("## EXECUTION CONTEXT"), "missing EXECUTION CONTEXT header")
  })

  it("sections are separated by double newline", () => {
    const result = buildBrief(makeConfig())
    const sections = result.split("\n\n")
    assert.equal(sections.length, 3, "expected exactly 3 sections separated by double newline")
  })
})

// ---------------------------------------------------------------------------
// ACTIVE POLICIES section
// ---------------------------------------------------------------------------

describe("buildBrief — ACTIVE POLICIES section", () => {
  it("includes all policies from all packs in order", () => {
    const result = buildBrief(makeConfig())
    const policiesSection = result.split("\n\n")[0]
    // global pack policies come first
    assert.ok(policiesSection.includes("- no_assumption_as_fact"), "missing global policy 1")
    assert.ok(policiesSection.includes("- evidence_required_for_claims"), "missing global policy 2")
    // design pack policies come after
    assert.ok(policiesSection.includes("- must_include_failure_model"), "missing design policy 1")
    assert.ok(policiesSection.includes("- must_define_module_boundaries"), "missing design policy 2")
  })

  it("global pack policies appear before task-type pack policies (order preserved)", () => {
    const result = buildBrief(makeConfig())
    const policiesSection = result.split("\n\n")[0]
    const globalIdx = policiesSection.indexOf("no_assumption_as_fact")
    const designIdx = policiesSection.indexOf("must_include_failure_model")
    assert.ok(globalIdx < designIdx, "global pack policies must appear before design pack policies")
  })

  it("policies from 3 packs all appear when high_risk pack active", () => {
    const config = makeConfig({
      active_packs: [GLOBAL_PACK, DESIGN_PACK, HIGH_RISK_PACK],
    })
    const result = buildBrief(config)
    const policiesSection = result.split("\n\n")[0]
    assert.ok(policiesSection.includes("- reviewer_required"), "missing high_risk policy")
    assert.ok(policiesSection.includes("- rollback_plan_mandatory"), "missing high_risk policy 2")
  })

  it("does not deduplicate repeated policy strings", () => {
    const packA: PolicyPack = { id: "a", policies: ["shared_policy"], gates: [], reviewer_checks: [] }
    const packB: PolicyPack = { id: "b", policies: ["shared_policy"], gates: [], reviewer_checks: [] }
    const config = makeConfig({ active_packs: [packA, packB] })
    const result = buildBrief(config)
    const policiesSection = result.split("\n\n")[0]
    const count = (policiesSection.match(/shared_policy/g) ?? []).length
    assert.equal(count, 2, "repeated policy should appear twice, not be deduplicated")
  })

  it("pack with empty policies[] contributes nothing to the section", () => {
    const emptyPack: PolicyPack = { id: "empty", policies: [], gates: [], reviewer_checks: [] }
    const config = makeConfig({ active_packs: [GLOBAL_PACK, emptyPack] })
    const result = buildBrief(config)
    const policiesSection = result.split("\n\n")[0]
    // Only GLOBAL_PACK's 2 policies should appear — no empty bullet from emptyPack
    const bulletCount = (policiesSection.match(/^- /gm) ?? []).length
    assert.equal(bulletCount, 2, "empty pack should not add bullets")
  })

  it("empty active_packs renders (none)", () => {
    const config = makeConfig({ active_packs: [] })
    const result = buildBrief(config)
    const policiesSection = result.split("\n\n")[0]
    assert.ok(policiesSection.includes("(none)"), "expected (none) when no packs")
    assert.ok(!policiesSection.includes("- "), "should have no bullets when (none)")
  })
})

// ---------------------------------------------------------------------------
// REQUIRED GATES section
// ---------------------------------------------------------------------------

describe("buildBrief — REQUIRED GATES section", () => {
  it("includes all required_gates as bullets", () => {
    const config = makeConfig({
      required_gates: ["evidence_required_gate", "verify_gate", "scope_gate"],
    })
    const result = buildBrief(config)
    const gatesSection = result.split("\n\n")[1]
    assert.ok(gatesSection.includes("- evidence_required_gate"))
    assert.ok(gatesSection.includes("- verify_gate"))
    assert.ok(gatesSection.includes("- scope_gate"))
  })

  it("gate order is preserved", () => {
    const config = makeConfig({
      required_gates: ["gate_z", "gate_a", "gate_m"],
    })
    const result = buildBrief(config)
    const gatesSection = result.split("\n\n")[1]
    const zIdx = gatesSection.indexOf("gate_z")
    const aIdx = gatesSection.indexOf("gate_a")
    const mIdx = gatesSection.indexOf("gate_m")
    assert.ok(zIdx < aIdx && aIdx < mIdx, "gate order must be preserved")
  })

  it("empty required_gates renders (none)", () => {
    const config = makeConfig({ required_gates: [] })
    const result = buildBrief(config)
    const gatesSection = result.split("\n\n")[1]
    assert.ok(gatesSection.includes("(none)"), "expected (none) when no gates")
    assert.ok(!gatesSection.includes("- "), "should have no bullets when (none)")
  })
})

// ---------------------------------------------------------------------------
// EXECUTION CONTEXT section
// ---------------------------------------------------------------------------

describe("buildBrief — EXECUTION CONTEXT section", () => {
  it("includes execution_mode", () => {
    const result = buildBrief(makeConfig({ execution_mode: "single" }))
    const contextSection = result.split("\n\n")[2]
    assert.ok(contextSection.includes("Execution mode: single"))
  })

  it("includes reviewer_mode", () => {
    const result = buildBrief(makeConfig({ reviewer_mode: "required" }))
    const contextSection = result.split("\n\n")[2]
    assert.ok(contextSection.includes("Reviewer mode: required"))
  })

  it("execution_mode proposal_reviewer renders verbatim", () => {
    const result = buildBrief(makeConfig({ execution_mode: "proposal_reviewer" }))
    const contextSection = result.split("\n\n")[2]
    assert.ok(contextSection.includes("Execution mode: proposal_reviewer"))
  })

  it("reviewer_mode none renders verbatim", () => {
    const result = buildBrief(makeConfig({ reviewer_mode: "none" }))
    const contextSection = result.split("\n\n")[2]
    assert.ok(contextSection.includes("Reviewer mode: none"))
  })
})

// ---------------------------------------------------------------------------
// Error conditions
// ---------------------------------------------------------------------------

describe("buildBrief — error conditions", () => {
  it("throws when config is null", () => {
    assert.throws(
      () => buildBrief(null as any),
      /buildBrief: config is required/,
      "should throw for null config"
    )
  })

  it("throws when config is undefined", () => {
    assert.throws(
      () => buildBrief(undefined as any),
      /buildBrief: config is required/,
      "should throw for undefined config"
    )
  })
})
