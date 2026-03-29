import { strict as assert } from "node:assert"
import { test } from "node:test"
import { resolvePolicies } from "../../src/resolver/policy-resolver"
import type { TaskContext } from "../../src/resolver/policy-resolver"

// ---------------------------------------------------------------------------
// Happy path: pack activation
// ---------------------------------------------------------------------------

test("low risk: activates global pack + task pack only", () => {
  const config = resolvePolicies({ task_type: "design", risk_level: "low" })

  assert.equal(config.active_packs.length, 2)
  assert.equal(config.active_packs[0].id, "global")
  assert.equal(config.active_packs[1].id, "design")
})

test("high risk: activates global + task + high_risk pack", () => {
  const config = resolvePolicies({ task_type: "design", risk_level: "high" })

  assert.equal(config.active_packs.length, 3)
  assert.equal(config.active_packs[2].id, "high_risk")
})

test("critical risk: activates global + task + high_risk pack", () => {
  const config = resolvePolicies({ task_type: "execution", risk_level: "critical" })

  assert.equal(config.active_packs.length, 3)
  assert.equal(config.active_packs[2].id, "high_risk")
})

test("medium risk: activates global + task pack only", () => {
  const config = resolvePolicies({ task_type: "planning", risk_level: "medium" })

  assert.equal(config.active_packs.length, 2)
  assert.equal(config.active_packs[0].id, "global")
  assert.equal(config.active_packs[1].id, "planning")
})

// ---------------------------------------------------------------------------
// reviewer_mode
// ---------------------------------------------------------------------------

test("low risk + no reviewer_checks: reviewer_mode is none", () => {
  const config = resolvePolicies({ task_type: "execution", risk_level: "low" })
  assert.equal(config.reviewer_mode, "none")
})

test("high risk: reviewer_mode is optional", () => {
  const config = resolvePolicies({ task_type: "execution", risk_level: "high" })
  assert.equal(config.reviewer_mode, "optional")
})

test("critical risk: reviewer_mode is required", () => {
  const config = resolvePolicies({ task_type: "execution", risk_level: "critical" })
  assert.equal(config.reviewer_mode, "required")
})

test("low risk + pack has reviewer_checks: reviewer_mode is optional", () => {
  // reasoning pack has reviewer_checks: ["counterexample_check"]
  const config = resolvePolicies({ task_type: "reasoning", risk_level: "low" })
  assert.equal(config.reviewer_mode, "optional")
})

test("low risk + design pack has reviewer_checks: reviewer_mode is optional", () => {
  // design pack has reviewer_checks: ["design_review_check"]
  const config = resolvePolicies({ task_type: "design", risk_level: "low" })
  assert.equal(config.reviewer_mode, "optional")
})

// ---------------------------------------------------------------------------
// required_gates: content and deduplication
// ---------------------------------------------------------------------------

test("global gates always present", () => {
  const config = resolvePolicies({ task_type: "planning", risk_level: "low" })
  assert.ok(config.required_gates.includes("evidence_required_gate"))
  assert.ok(config.required_gates.includes("verify_gate"))
  assert.ok(config.required_gates.includes("no_op_detection_gate"))
})

test("task-type gates included", () => {
  const config = resolvePolicies({ task_type: "debugging", risk_level: "low" })
  assert.ok(config.required_gates.includes("reproduction_gate"))
  assert.ok(config.required_gates.includes("root_cause_gate"))
  assert.ok(config.required_gates.includes("test_pass_gate"))
})

test("high_risk gates included when risk is high", () => {
  const config = resolvePolicies({ task_type: "planning", risk_level: "high" })
  assert.ok(config.required_gates.includes("rollback_gate"))
})

test("verify_gate deduplicated — verification pack + global both have it", () => {
  const config = resolvePolicies({ task_type: "verification", risk_level: "low" })
  const verifyGates = config.required_gates.filter(g => g === "verify_gate")
  assert.equal(verifyGates.length, 1)
})

test("scope_gate deduplicated — design pack has it, crosses_module_boundary adds it only if absent", () => {
  const config = resolvePolicies({
    task_type: "design",
    risk_level: "low",
    crosses_module_boundary: true,
  })
  const scopeGates = config.required_gates.filter(g => g === "scope_gate")
  assert.equal(scopeGates.length, 1)
})

test("gate order: global gates come first", () => {
  const config = resolvePolicies({ task_type: "design", risk_level: "low" })
  const firstGate = config.required_gates[0]
  assert.equal(firstGate, "evidence_required_gate")
})

// ---------------------------------------------------------------------------
// Flags: is_irreversible, crosses_module_boundary
// ---------------------------------------------------------------------------

test("is_irreversible: rollback_gate added when not already present", () => {
  // planning pack does not include rollback_gate
  const config = resolvePolicies({
    task_type: "planning",
    risk_level: "low",
    is_irreversible: true,
  })
  assert.ok(config.required_gates.includes("rollback_gate"))
})

test("is_irreversible on high risk: rollback_gate not duplicated (high_risk pack already has it)", () => {
  const config = resolvePolicies({
    task_type: "planning",
    risk_level: "high",
    is_irreversible: true,
  })
  const rollbackGates = config.required_gates.filter(g => g === "rollback_gate")
  assert.equal(rollbackGates.length, 1)
})

test("crosses_module_boundary: scope_gate added when not already present", () => {
  // execution pack does not include scope_gate
  const config = resolvePolicies({
    task_type: "execution",
    risk_level: "low",
    crosses_module_boundary: true,
  })
  assert.ok(config.required_gates.includes("scope_gate"))
})

test("is_irreversible false (default): rollback_gate absent at low risk", () => {
  const config = resolvePolicies({ task_type: "planning", risk_level: "low" })
  assert.ok(!config.required_gates.includes("rollback_gate"))
})

// ---------------------------------------------------------------------------
// execution_mode
// ---------------------------------------------------------------------------

test("execution_mode defaults to single when not provided", () => {
  const config = resolvePolicies({ task_type: "design", risk_level: "low" })
  assert.equal(config.execution_mode, "single")
})

test("execution_mode is preserved when provided", () => {
  const config = resolvePolicies({
    task_type: "design",
    risk_level: "high",
    execution_mode: "proposal_reviewer",
  })
  assert.equal(config.execution_mode, "proposal_reviewer")
})

test("parallel execution_mode preserved", () => {
  const config = resolvePolicies({
    task_type: "reasoning",
    risk_level: "low",
    execution_mode: "parallel",
  })
  assert.equal(config.execution_mode, "parallel")
})

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

test("unknown task_type throws", () => {
  assert.throws(
    () => resolvePolicies({ task_type: "nonexistent" as any, risk_level: "low" }),
    /unknown task_type: nonexistent/,
  )
})

test("unknown risk_level throws", () => {
  assert.throws(
    () => resolvePolicies({ task_type: "design", risk_level: "extreme" as any }),
    /unknown risk_level: extreme/,
  )
})

// ---------------------------------------------------------------------------
// All 10 task types resolve without error
// ---------------------------------------------------------------------------

test("all 10 task types resolve successfully", () => {
  const taskTypes: TaskContext["task_type"][] = [
    "problem_framing", "reasoning", "design", "execution", "verification",
    "planning", "communication", "learning", "debugging", "incident",
  ]
  for (const task_type of taskTypes) {
    const config = resolvePolicies({ task_type, risk_level: "low" })
    assert.ok(config.active_packs.length >= 2, `${task_type}: expected >= 2 packs`)
    assert.ok(config.required_gates.length >= 3, `${task_type}: expected >= 3 gates`)
  }
})

// ---------------------------------------------------------------------------
// All 4 risk levels resolve without error
// ---------------------------------------------------------------------------

test("all 4 risk levels resolve successfully", () => {
  const riskLevels: TaskContext["risk_level"][] = ["low", "medium", "high", "critical"]
  for (const risk_level of riskLevels) {
    const config = resolvePolicies({ task_type: "design", risk_level })
    assert.ok(config.active_packs.length >= 2, `${risk_level}: expected >= 2 packs`)
  }
})
