// gate-engine.ts
// Unit 0.3: Gate Engine
//
// Deterministic gate functions + executor.
// Takes LLM output + context, returns structured verdict.
// No LLM calls. No I/O. Pure functions.
//
// Phase 0 gate implementations use keyword heuristics — intentionally simple.
// Goal: validate executor precedence logic and pipeline structure.
// Production-quality semantic gates belong to Phase 1+.

import { TaskContext, ExecutionConfig } from "../resolver/policy-resolver.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GateVerdict = "pass" | "fail" | "reject" | "downgrade"

export interface GateResult {
  gate_id: string
  verdict: GateVerdict
  reason: string  // required for all non-pass verdicts; empty string for pass
}

export interface GateContext {
  gate_id: string
  llm_output: string
  task_context: TaskContext
  execution_config: ExecutionConfig
}

export type Gate = (ctx: GateContext) => GateResult

export type ExecutorVerdict = "pass" | "fail" | "reject" | "downgrade"

export interface GateExecutorResult {
  verdict: ExecutorVerdict
  results: GateResult[]
  stopped_at?: string  // gate_id that triggered early stop — only set on reject
}

// ---------------------------------------------------------------------------
// Gate executor
// ---------------------------------------------------------------------------

export function runGates(
  gates: Gate[],
  ctx: Omit<GateContext, "gate_id">
): GateExecutorResult {
  if (gates == null) throw new Error("runGates: gates is required")
  if (ctx == null) throw new Error("runGates: ctx is required")

  const results: GateResult[] = []

  for (const gate of gates) {
    const gateCtx: GateContext = { ...ctx, gate_id: "" }
    // Run the gate — gate_id is set by the gate itself in its result
    const result = gate(gateCtx)
    results.push(result)

    if (result.verdict === "reject") {
      // Reject stops immediately — no further gates run
      return { verdict: "reject", results, stopped_at: result.gate_id }
    }
  }

  // All gates ran — determine final verdict by precedence: fail > downgrade > pass
  const hasFail = results.some((r) => r.verdict === "fail")
  if (hasFail) return { verdict: "fail", results }

  const hasDowngrade = results.some((r) => r.verdict === "downgrade")
  if (hasDowngrade) return { verdict: "downgrade", results }

  return { verdict: "pass", results }
}

// ---------------------------------------------------------------------------
// Phase 0 gate implementations (keyword heuristics)
// ---------------------------------------------------------------------------

// Helper: check if text contains any of the given keywords (case-insensitive)
function containsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase()
  return keywords.some((kw) => lower.includes(kw))
}

// evidence_required_gate
// Does the output cite evidence or reasons for its claims?
export const evidenceRequiredGate: Gate = (ctx) => {
  const markers = ["because", "based on", "source:", "evidence:", "reason:", "due to", "since", "as shown", "according to"]
  if (containsAny(ctx.llm_output, markers)) {
    return { gate_id: "evidence_required_gate", verdict: "pass", reason: "" }
  }
  return {
    gate_id: "evidence_required_gate",
    verdict: "fail",
    reason: "Output contains no evidence markers. Claims must be grounded with 'because', 'based on', 'reason:', or equivalent.",
  }
}

// verify_gate
// Does the output include a verification step or plan?
export const verifyGate: Gate = (ctx) => {
  const markers = ["verify", "check", "confirm", "test", "validate", "assert", "ensure", "review"]
  if (containsAny(ctx.llm_output, markers)) {
    return { gate_id: "verify_gate", verdict: "pass", reason: "" }
  }
  return {
    gate_id: "verify_gate",
    verdict: "fail",
    reason: "Output contains no verification markers. Include a verification or checking step.",
  }
}

// no_op_detection_gate
// Does the output actually do something non-trivial?
export const noOpDetectionGate: Gate = (ctx) => {
  const output = ctx.llm_output.trim()
  if (output.length <= 50) { // execution-leak-ignore
    return {
      gate_id: "no_op_detection_gate",
      verdict: "fail",
      reason: `Output is too short (${output.length} chars). A substantive response is required.`,
    }
  }
  // Check for pure filler — output that is only acknowledgement phrases
  const fillerOnly = /^(ok|okay|sure|got it|understood|will do|done|yes|no)[.!]?$/i.test(output)
  if (fillerOnly) {
    return {
      gate_id: "no_op_detection_gate",
      verdict: "fail",
      reason: "Output is a filler acknowledgement with no substantive content.",
    }
  }
  return { gate_id: "no_op_detection_gate", verdict: "pass", reason: "" }
}

// scope_gate
// Does the output stay within stated scope?
// Downgrades (not fails) when out-of-scope signals are detected — scope violations
// are a quality concern, not a hard block.
export const scopeGate: Gate = (ctx) => {
  const outOfScopeMarkers = ["unrelated to", "outside the scope", "not part of this", "out of scope", "beyond the scope"]
  if (containsAny(ctx.llm_output, outOfScopeMarkers)) {
    return {
      gate_id: "scope_gate",
      verdict: "downgrade",
      reason: "Output contains signals of scope expansion. Review whether the response stays within the requested boundary.",
    }
  }
  return { gate_id: "scope_gate", verdict: "pass", reason: "" }
}

// test_pass_gate
// For execution tasks: does the output mention tests passing?
// For all other task types: always passes.
export const testPassGate: Gate = (ctx) => {
  if (ctx.task_context.task_type !== "execution") {
    return { gate_id: "test_pass_gate", verdict: "pass", reason: "" }
  }
  const markers = ["tests pass", "test pass", "all tests", "passing", "green", "✓", "✅", "no failures"]
  if (containsAny(ctx.llm_output, markers)) {
    return { gate_id: "test_pass_gate", verdict: "pass", reason: "" }
  }
  return {
    gate_id: "test_pass_gate",
    verdict: "fail",
    reason: "Execution task output does not confirm tests are passing. Include test results.",
  }
}

// multi_option_gate
// Does the output present at least 2 options or alternatives?
export const multiOptionGate: Gate = (ctx) => {
  const lower = ctx.llm_output.toLowerCase()
  // Count distinct option signals
  const signals = [
    /option\s*[1-9]/,
    /alternative\s*[1-9]/,
    /approach\s*[1-9]/,
    /\b1\.\s/,
    /\b2\.\s/,
    /\bfirst[ly]?\b/,
    /\bsecond[ly]?\b/,
    /\ba\)\s/,
    /\bb\)\s/,
  ]
  const matchCount = signals.filter((re) => re.test(lower)).length
  // Need at least 2 distinct signals to indicate multiple options
  if (matchCount >= 2) { // execution-leak-ignore
    return { gate_id: "multi_option_gate", verdict: "pass", reason: "" }
  }
  return {
    gate_id: "multi_option_gate",
    verdict: "fail",
    reason: "Output does not present multiple options or alternatives. Provide at least 2 distinct approaches.",
  }
}

// design_completeness_gate
// Does the output include failure model and/or risk considerations?
export const designCompletenessGate: Gate = (ctx) => {
  const markers = ["failure", "risk", "rollback", "fallback", "if it fails", "failure mode", "mitigat", "contingency", "edge case"]
  if (containsAny(ctx.llm_output, markers)) {
    return { gate_id: "design_completeness_gate", verdict: "pass", reason: "" }
  }
  return {
    gate_id: "design_completeness_gate",
    verdict: "fail",
    reason: "Output does not address failure modes or risks. Include failure model, rollback plan, or risk analysis.",
  }
}

// ---------------------------------------------------------------------------
// Gate registry — maps gate_id strings to Gate functions
// ---------------------------------------------------------------------------

export const GATE_REGISTRY: Record<string, Gate> = {
  evidence_required_gate: evidenceRequiredGate,
  verify_gate: verifyGate,
  no_op_detection_gate: noOpDetectionGate,
  scope_gate: scopeGate,
  test_pass_gate: testPassGate,
  multi_option_gate: multiOptionGate,
  design_completeness_gate: designCompletenessGate,
}

// Resolve a list of gate_ids to Gate functions.
// Unknown gate_ids are silently skipped — caller is responsible for ensuring
// required_gates only contains known ids.
export function resolveGates(gate_ids: string[]): Gate[] {
  return gate_ids.flatMap((id) => {
    const gate = GATE_REGISTRY[id]
    return gate ? [gate] : []
  })
}
