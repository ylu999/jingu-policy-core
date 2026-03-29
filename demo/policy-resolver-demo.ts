// policy-resolver-demo.ts
// Unit 0.1 Demo — PolicyResolver
//
// Shows: what activates for different task contexts.
// Run: npm run demo:resolver

import { resolvePolicies } from "../src/resolver/policy-resolver"
import type { TaskContext, ExecutionConfig } from "../src/resolver/policy-resolver"

// ---------------------------------------------------------------------------
// Printer
// ---------------------------------------------------------------------------

function printConfig(label: string, ctx: TaskContext, config: ExecutionConfig) {
  console.log(`\n${"─".repeat(60)}`)
  console.log(`Scenario: ${label}`)
  console.log(`  task_type : ${ctx.task_type}`)
  console.log(`  risk_level: ${ctx.risk_level}`)
  if (ctx.execution_mode)        console.log(`  exec_mode : ${ctx.execution_mode}`)
  if (ctx.is_irreversible)       console.log(`  irreversible: true`)
  if (ctx.crosses_module_boundary) console.log(`  crosses_boundary: true`)
  console.log()
  console.log(`  active_packs    : [${config.active_packs.map(p => p.id).join(", ")}]`)
  console.log(`  reviewer_mode   : ${config.reviewer_mode}`)
  console.log(`  execution_mode  : ${config.execution_mode}`)
  console.log(`  required_gates  : ${config.required_gates.length} gates`)
  for (const gate of config.required_gates) {
    console.log(`    - ${gate}`)
  }
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

console.log("PolicyResolver Demo — Unit 0.1")
console.log("==============================")

// 1. Simple design task, low risk
const ctx1: TaskContext = { task_type: "design", risk_level: "low" }
printConfig("design / low risk", ctx1, resolvePolicies(ctx1))

// 2. Same task, high risk — reviewer and rollback added
const ctx2: TaskContext = { task_type: "design", risk_level: "high" }
printConfig("design / high risk", ctx2, resolvePolicies(ctx2))

// 3. Critical incident — reviewer required
const ctx3: TaskContext = { task_type: "incident", risk_level: "critical" }
printConfig("incident / critical", ctx3, resolvePolicies(ctx3))

// 4. Execution + irreversible flag
const ctx4: TaskContext = {
  task_type: "execution",
  risk_level: "medium",
  is_irreversible: true,
}
printConfig("execution / medium + irreversible", ctx4, resolvePolicies(ctx4))

// 5. Reasoning — triggers optional reviewer even at low risk (pack has reviewer_checks)
const ctx5: TaskContext = { task_type: "reasoning", risk_level: "low" }
printConfig("reasoning / low risk (reviewer_checks in pack)", ctx5, resolvePolicies(ctx5))

// 6. Debugging — show all 3 debugging-specific gates
const ctx6: TaskContext = { task_type: "debugging", risk_level: "low" }
printConfig("debugging / low risk", ctx6, resolvePolicies(ctx6))

// 7. Design + crosses_module_boundary — scope_gate deduplicated (already in design pack)
const ctx7: TaskContext = {
  task_type: "design",
  risk_level: "low",
  crosses_module_boundary: true,
}
printConfig("design / crosses_module_boundary (scope_gate dedup)", ctx7, resolvePolicies(ctx7))

// 8. Custom execution_mode
const ctx8: TaskContext = {
  task_type: "design",
  risk_level: "high",
  execution_mode: "proposal_reviewer",
}
printConfig("design / high + proposal_reviewer mode", ctx8, resolvePolicies(ctx8))

// 9. Error case — unknown task_type
console.log(`\n${"─".repeat(60)}`)
console.log("Scenario: error — unknown task_type")
try {
  resolvePolicies({ task_type: "nonexistent" as any, risk_level: "low" })
} catch (e) {
  console.log(`  throws: ${(e as Error).message}`)
}

console.log(`\n${"─".repeat(60)}`)
console.log("Done.")
