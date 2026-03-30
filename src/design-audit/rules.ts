// src/linter/rules.ts
// Jingu Design Linter — the 4 invariant checkers
//
// Each function checks one invariant and returns zero or more DesignIssue[].
// All functions are pure — no I/O, no side effects.

import type { LoopDesignSpec, DesignIssue } from "./types.js"

// ---------------------------------------------------------------------------
// Rule 1 — State Machine Completeness
//
// Invariant: all execution paths must converge to a deterministic verdict.
//
// Checks:
//   - maxAttempts must be > 0
//   - maxAttempts > 3 is a risk (unbounded loop pressure)
//   - invalid_output must appear in verdicts (contract violations need a home)
//   - binding_validator must appear before reviewer in stages
// ---------------------------------------------------------------------------

export function checkStateMachineCompleteness(spec: LoopDesignSpec): DesignIssue[] {
  const issues: DesignIssue[] = []

  if (spec.retryPolicy.maxAttempts <= 0) {
    issues.push({
      rule: "state_machine_completeness",
      code: "INVALID_RETRY_POLICY",
      severity: "error",
      message: "retryPolicy.maxAttempts must be > 0. A loop with 0 attempts has no execution path.",
    })
  }

  if (spec.retryPolicy.maxAttempts > 3) {
    issues.push({
      rule: "state_machine_completeness",
      code: "UNBOUNDED_RETRY_RISK",
      severity: "warning",
      message: `retryPolicy.maxAttempts=${spec.retryPolicy.maxAttempts} is high. Loops with >3 attempts risk non-termination under adversarial LLM behavior.`,
    })
  }

  if (!spec.verdicts.includes("invalid_output")) {
    issues.push({
      rule: "state_machine_completeness",
      code: "MISSING_INVALID_OUTPUT_VERDICT",
      severity: "error",
      message: "Verdict set does not include 'invalid_output'. Contract violations (syntax/structure failures) have no deterministic terminal state.",
    })
  }

  // binding_validator must come before reviewer — reviewer must never run on invalid structure
  const bindingIdx = spec.stages.indexOf("binding_validator")
  const reviewerIdx = spec.stages.indexOf("reviewer")
  if (bindingIdx !== -1 && reviewerIdx !== -1 && reviewerIdx < bindingIdx) {
    issues.push({
      rule: "state_machine_completeness",
      code: "REVIEWER_BEFORE_BINDING",
      severity: "error",
      message: "Stage 'reviewer' appears before 'binding_validator'. Reviewer must never run on structurally invalid output — binding validation is a precondition for semantic evaluation.",
    })
  }

  return issues
}

// ---------------------------------------------------------------------------
// Rule 2 — Layer Separation
//
// Invariant: syntax / structure / semantics / execution errors must not
// be collapsed into the same handling bucket.
//
// Checks:
//   - syntax errors and structure errors must not share the same retry behavior
//     (they are different problems — one is JSON parsing, the other is provenance)
//   - reviewer (semantics) must not appear if binding_validator is absent
// ---------------------------------------------------------------------------

export function checkLayerSeparation(spec: LoopDesignSpec): DesignIssue[] {
  const issues: DesignIssue[] = []

  const syntaxCodes = spec.errorTypes.filter(e => e.layer === "syntax").map(e => e.code)
  const structureCodes = spec.errorTypes.filter(e => e.layer === "structure").map(e => e.code)

  if (syntaxCodes.length > 0 && structureCodes.length > 0) {
    const retryOn = spec.retryPolicy.retryOn
    const syntaxRetried = syntaxCodes.some(c => retryOn.includes(c))
    const structureRetried = structureCodes.some(c => retryOn.includes(c))
    if (syntaxRetried && structureRetried) {
      issues.push({
        rule: "layer_separation",
        code: "MIXED_LAYER_RETRY",
        severity: "warning",
        message: "Both syntax-layer and structure-layer errors are in retryOn. These are different failure modes (JSON parsing vs provenance graph) and should be handled with different retry strategies.",
      })
    }
  }

  // If reviewer is in the pipeline, binding_validator must also be present
  if (spec.stages.includes("reviewer") && !spec.stages.includes("binding_validator")) {
    issues.push({
      rule: "layer_separation",
      code: "SEMANTICS_WITHOUT_STRUCTURE_GATE",
      severity: "error",
      message: "Stage 'reviewer' (semantics layer) is present but 'binding_validator' (structure layer) is absent. Semantic evaluation of structurally invalid output produces undefined behavior.",
    })
  }

  return issues
}

// ---------------------------------------------------------------------------
// Rule 3 — Recoverability
//
// Invariant: retry must only be triggered by recoverable errors.
//
// Checks:
//   - every code in retryOn must map to an errorType with recoverable=true
//   - retryOn must not be empty if maxAttempts > 1 (retry has no trigger condition)
// ---------------------------------------------------------------------------

export function checkRecoverability(spec: LoopDesignSpec): DesignIssue[] {
  const issues: DesignIssue[] = []

  const errorByCode = new Map(spec.errorTypes.map(e => [e.code, e]))

  for (const code of spec.retryPolicy.retryOn) {
    const errorSpec = errorByCode.get(code)
    if (!errorSpec) {
      issues.push({
        rule: "recoverability",
        code: "UNDEFINED_RETRY_CODE",
        severity: "error",
        message: `retryOn includes error code "${code}" which is not defined in errorTypes. Cannot determine recoverability.`,
      })
      continue
    }
    if (!errorSpec.recoverable) {
      issues.push({
        rule: "recoverability",
        code: "NON_RECOVERABLE_RETRY",
        severity: "error",
        message: `Error "${code}" (layer: ${errorSpec.layer}) is marked recoverable=false but appears in retryOn. Retrying non-recoverable errors wastes a loop attempt without improving outcome probability.`,
      })
    }
  }

  if (spec.retryPolicy.maxAttempts > 1 && spec.retryPolicy.retryOn.length === 0) {
    issues.push({
      rule: "recoverability",
      code: "RETRY_WITH_NO_TRIGGER",
      severity: "warning",
      message: "maxAttempts > 1 but retryOn is empty. Retry is configured but has no trigger condition — the extra attempt will never be used.",
    })
  }

  return issues
}

// ---------------------------------------------------------------------------
// Rule 4 — Contract Enforcement
//
// Invariant: LLM contract violations (syntax + structure failures) must be
// classified as 'invalid_output', not mixed with normal execution failures.
//
// Checks:
//   - any syntax-layer error must map to invalid_output verdict (not fail/reject)
//   - any structure-layer error must map to invalid_output verdict
//   - if contractLayer errors exist but invalid_output is missing from verdicts,
//     contract violations have nowhere to go
// ---------------------------------------------------------------------------

export function checkContractEnforcement(spec: LoopDesignSpec): DesignIssue[] {
  const issues: DesignIssue[] = []

  const contractLayers: Array<"syntax" | "structure"> = ["syntax", "structure"]
  const hasContractErrors = spec.errorTypes.some(e => contractLayers.includes(e.layer as "syntax" | "structure"))

  if (hasContractErrors && !spec.verdicts.includes("invalid_output")) {
    issues.push({
      rule: "contract_enforcement",
      code: "CONTRACT_VIOLATIONS_WITHOUT_VERDICT",
      severity: "error",
      message: "ErrorTypes include syntax or structure layer errors (LLM contract violations) but 'invalid_output' is not in verdicts. Contract violations cannot be distinguished from execution failures.",
    })
  }

  // Detect if syntax errors are retried (syntax = LLM ignored the contract completely)
  const syntaxErrors = spec.errorTypes.filter(e => e.layer === "syntax")
  for (const err of syntaxErrors) {
    if (spec.retryPolicy.retryOn.includes(err.code)) {
      issues.push({
        rule: "contract_enforcement",
        code: "SYNTAX_ERROR_RETRIED",
        severity: "warning",
        message: `Syntax error "${err.code}" is in retryOn. Syntax failures mean the LLM did not produce parseable output — retry may help for transient issues but should only apply if the error is explicitly marked recoverable=true.`,
      })
    }
  }

  return issues
}
