// gate-engine-demo.ts
// Unit 0.3 Demo — Gate Engine
//
// Shows: resolver → gates pipeline. Given a TaskContext + simulated LLM output,
// what does the gate executor decide? Demonstrates precedence rules and all 7 gates.
// Run: npm run demo:gates

import { resolvePolicies } from "../src/resolver/policy-resolver"
import { resolveGates, runGates } from "../src/gates/gate-engine"
import type { TaskContext } from "../src/resolver/policy-resolver"
import type { GateExecutorResult } from "../src/gates/gate-engine"

// ---------------------------------------------------------------------------
// Printer
// ---------------------------------------------------------------------------

const LINE = "─".repeat(68)

function printResult(label: string, ctx: TaskContext, llm_output: string, result: GateExecutorResult) {
  console.log(`\n${LINE}`)
  console.log(`Scenario: ${label}`)
  console.log(`Task:     task_type=${ctx.task_type}, risk_level=${ctx.risk_level}`)
  console.log(`Output:   "${llm_output.length > 60 ? llm_output.slice(0, 60) + "…" : llm_output}"`)
  console.log(``)
  console.log(`  Executor verdict: ${result.verdict.toUpperCase()}${result.stopped_at ? ` (stopped at: ${result.stopped_at})` : ""}`)
  console.log(``)
  for (const r of result.results) {
    const icon = r.verdict === "pass" ? "✓" : r.verdict === "fail" ? "✗" : r.verdict === "downgrade" ? "↓" : "✗✗"
    console.log(`  [${icon}] ${r.gate_id.padEnd(30)} ${r.verdict}${r.reason ? ` — ${r.reason.slice(0, 60)}` : ""}`)
  }
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

console.log("Gate Engine Demo — Unit 0.3")
console.log("=================================")
console.log("Shows: TaskContext → resolvePolicies() → resolveGates() → runGates() → verdict")

// Scenario 1: Good design output — all gates pass
{
  const ctx: TaskContext = { task_type: "design", risk_level: "low" }
  const config = resolvePolicies(ctx)
  const gates = resolveGates(config.required_gates)
  const llm_output = `Based on the requirements, here is the design. First option: use a layered architecture. Second option: use a microservices approach. The risk of option 1 is coupling; rollback plan is to revert to the prior architecture. We should verify the design by running integration tests. Because the spec requires backward compatibility, option 1 is preferred.`
  const result = runGates(gates, { llm_output, task_context: ctx, execution_config: config })
  printResult("design / low risk — good output", ctx, llm_output, result)
}

// Scenario 2: Design output with no evidence — fails evidence_required_gate
{
  const ctx: TaskContext = { task_type: "design", risk_level: "low" }
  const config = resolvePolicies(ctx)
  const gates = resolveGates(config.required_gates)
  const llm_output = `The best approach is to use a layered architecture. This will make the system easier to maintain and scale over time. First option: layered. Second option: microservices. The risk of migration exists but rollback is straightforward. Verify using integration tests.`
  const result = runGates(gates, { llm_output, task_context: ctx, execution_config: config })
  printResult("design / low risk — no evidence markers → fail", ctx, llm_output, result)
}

// Scenario 3: No-op output — fails no_op_detection_gate
{
  const ctx: TaskContext = { task_type: "design", risk_level: "low" }
  const config = resolvePolicies(ctx)
  const gates = resolveGates(config.required_gates)
  const llm_output = `Got it.`
  const result = runGates(gates, { llm_output, task_context: ctx, execution_config: config })
  printResult("design / low risk — filler output → fail", ctx, llm_output, result)
}

// Scenario 4: Execution task — all gates pass with test confirmation
{
  const ctx: TaskContext = { task_type: "execution", risk_level: "medium" }
  const config = resolvePolicies(ctx)
  const gates = resolveGates(config.required_gates)
  const llm_output = `Implementation complete. All tests pass ✅. Based on the test results, the implementation is correct. We verify that edge cases are covered. No failures found.`
  const result = runGates(gates, { llm_output, task_context: ctx, execution_config: config })
  printResult("execution / medium — tests confirmed → pass", ctx, llm_output, result)
}

// Scenario 5: test_pass_gate directly — execution task, no test markers → fail
// (test_pass_gate is in GATE_REGISTRY; used directly here to show its behavior)
{
  const ctx: TaskContext = { task_type: "execution", risk_level: "medium" }
  const config = resolvePolicies(ctx)
  const gates = resolveGates(["no_op_detection_gate", "evidence_required_gate", "test_pass_gate"])
  const llm_output = `Implementation complete. Based on code review, the changes are correct. We should verify the behavior by checking the logs. The risk of regression is low because the changes are isolated.`
  const result = runGates(gates, { llm_output, task_context: ctx, execution_config: config })
  printResult("execution — test_pass_gate direct — no test confirmation → fail", ctx, llm_output, result)
}

// Scenario 6: Out-of-scope signal in design task → scope_gate downgrade (others pass)
{
  const ctx: TaskContext = { task_type: "design", risk_level: "low" }
  const config = resolvePolicies(ctx)
  const gates = resolveGates(config.required_gates)
  const llm_output = `Based on the analysis, the core design uses layered architecture. First option: layered. Second option: microservices. The risk is coupling; rollback plan is straightforward. We should verify with integration tests. This section is unrelated to the design but may be relevant for future reference.`
  const result = runGates(gates, { llm_output, task_context: ctx, execution_config: config })
  printResult("design — out-of-scope signal → scope_gate downgrade", ctx, llm_output, result)
}

// Scenario 7: Error — null ctx
{
  console.log(`\n${LINE}`)
  console.log("Scenario: error — null ctx passed to runGates()")
  try {
    runGates([], null as unknown as Parameters<typeof runGates>[1])
    console.log("  ERROR: expected throw but none occurred")
  } catch (e) {
    console.log(`  throws: ${(e as Error).message}`)
  }
}

console.log(`\n${LINE}`)
console.log("Done.\n")
