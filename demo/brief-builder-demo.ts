// brief-builder-demo.ts
// Unit 0.2 Demo — Brief Builder
//
// Shows: resolver → brief pipeline. What the LLM actually sees for different
// task contexts. Demonstrates the full Unit 0.1 → Unit 0.2 handoff.
// Run: npm run demo:brief

import { resolvePolicies } from "../src/resolver/policy-resolver"
import { buildBrief } from "../src/brief/brief-builder"
import type { TaskContext } from "../src/resolver/policy-resolver"

// ---------------------------------------------------------------------------
// Printer
// ---------------------------------------------------------------------------

function printScenario(label: string, ctx: TaskContext) {
  console.log(`\n${"─".repeat(68)}`)
  console.log(`Scenario: ${label}`)
  console.log(`Input:    task_type=${ctx.task_type}, risk_level=${ctx.risk_level}` +
    (ctx.execution_mode ? `, execution_mode=${ctx.execution_mode}` : "") +
    (ctx.is_irreversible ? ", is_irreversible=true" : "") +
    (ctx.crosses_module_boundary ? ", crosses_module_boundary=true" : ""))
  console.log()

  const config = resolvePolicies(ctx)
  const brief = buildBrief(config)

  // Print the brief with indentation for readability
  const indented = brief.split("\n").map(line => `  ${line}`).join("\n")
  console.log(indented)
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

console.log("Brief Builder Demo — Unit 0.2")
console.log("=================================")
console.log("Shows the brief string injected into the LLM prompt.")
console.log("Pipeline: TaskContext → resolvePolicies() → buildBrief() → string")

// 1. Design / low risk — 2 packs, optional reviewer
printScenario("design / low risk", {
  task_type: "design",
  risk_level: "low",
})

// 2. Design / high risk — 3 packs, more policies and gates
printScenario("design / high risk", {
  task_type: "design",
  risk_level: "high",
})

// 3. Incident / critical — required reviewer
printScenario("incident / critical", {
  task_type: "incident",
  risk_level: "critical",
})

// 4. Execution + irreversible — rollback_gate appended by flag
printScenario("execution / medium + irreversible", {
  task_type: "execution",
  risk_level: "medium",
  is_irreversible: true,
})

// 5. Proposal+reviewer mode — execution_mode shows verbatim in brief
printScenario("reasoning / high + proposal_reviewer mode", {
  task_type: "reasoning",
  risk_level: "high",
  execution_mode: "proposal_reviewer",
})

// 6. Error case — null config
console.log(`\n${"─".repeat(68)}`)
console.log("Scenario: error — null config passed to buildBrief()")
try {
  buildBrief(null as any)
} catch (e) {
  console.log(`  throws: ${(e as Error).message}`)
}

console.log(`\n${"─".repeat(68)}`)
console.log("Done.")
