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
      kind: "invariant",
      severity: "error",
      message: "retryPolicy.maxAttempts must be > 0. A loop with 0 attempts has no execution path.",
      remediation_hint: "Set retryPolicy.maxAttempts to 1 (single attempt, no retry) or higher.",
    })
  }

  if (spec.retryPolicy.maxAttempts > 3) {
    issues.push({
      rule: "state_machine_completeness",
      code: "UNBOUNDED_RETRY_RISK",
      kind: "heuristic",
      severity: "warning",
      message: `retryPolicy.maxAttempts=${spec.retryPolicy.maxAttempts} is high. Loops with >3 attempts risk non-termination under adversarial LLM behavior.`,
      remediation_hint: "Reduce retryPolicy.maxAttempts to <= 3, or add spec.justifications[\"UNBOUNDED_RETRY_RISK\"] explaining why higher retry is required.",
    })
  }

  if (!spec.verdicts.includes("invalid_output")) {
    issues.push({
      rule: "state_machine_completeness",
      code: "MISSING_INVALID_OUTPUT_VERDICT",
      kind: "invariant",
      severity: "error",
      message: "Verdict set does not include 'invalid_output'. Contract violations (syntax/structure failures) have no deterministic terminal state.",
      remediation_hint: "Add 'invalid_output' to verdicts.",
    })
  }

  // binding_validator must come before reviewer — reviewer must never run on invalid structure
  const bindingIdx = spec.stages.indexOf("binding_validator")
  const reviewerIdx = spec.stages.indexOf("reviewer")
  if (bindingIdx !== -1 && reviewerIdx !== -1 && reviewerIdx < bindingIdx) {
    issues.push({
      rule: "state_machine_completeness",
      code: "REVIEWER_BEFORE_BINDING",
      kind: "invariant",
      severity: "error",
      message: "Stage 'reviewer' appears before 'binding_validator'. Reviewer must never run on structurally invalid output — binding validation is a precondition for semantic evaluation.",
      remediation_hint: "Reorder stages so 'binding_validator' appears before 'reviewer'.",
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
        kind: "heuristic",
        severity: "warning",
        message: "Both syntax-layer and structure-layer errors are in retryOn. These are different failure modes (JSON parsing vs provenance graph) and should be handled with different retry strategies.",
        remediation_hint: "Separate retry handling: syntax failures usually mean the LLM ignored the format entirely (consider not retrying); structure failures may be recoverable with targeted feedback.",
      })
    }
  }

  // If reviewer is in the pipeline, binding_validator must also be present
  if (spec.stages.includes("reviewer") && !spec.stages.includes("binding_validator")) {
    issues.push({
      rule: "layer_separation",
      code: "SEMANTICS_WITHOUT_STRUCTURE_GATE",
      kind: "invariant",
      severity: "error",
      message: "Stage 'reviewer' (semantics layer) is present but 'binding_validator' (structure layer) is absent. Semantic evaluation of structurally invalid output produces undefined behavior.",
      remediation_hint: "Add 'binding_validator' to stages before 'reviewer'.",
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
        kind: "invariant",
        severity: "error",
        message: `retryOn includes error code "${code}" which is not defined in errorTypes. Cannot determine recoverability.`,
        remediation_hint: `Add an ErrorTypeSpec with code="${code}" to errorTypes, or remove "${code}" from retryOn.`,
      })
      continue
    }
    if (!errorSpec.recoverable) {
      issues.push({
        rule: "recoverability",
        code: "NON_RECOVERABLE_RETRY",
        kind: "invariant",
        severity: "error",
        message: `Error "${code}" (layer: ${errorSpec.layer}) is marked recoverable=false but appears in retryOn. Retrying non-recoverable errors wastes a loop attempt without improving outcome probability.`,
        remediation_hint: `Remove "${code}" from retryOn, or set its recoverable=true if prompt feedback can actually fix this error.`,
      })
    }
  }

  if (spec.retryPolicy.maxAttempts > 1 && spec.retryPolicy.retryOn.length === 0) {
    issues.push({
      rule: "recoverability",
      code: "RETRY_WITH_NO_TRIGGER",
      kind: "heuristic",
      severity: "warning",
      message: "maxAttempts > 1 but retryOn is empty. Retry is configured but has no trigger condition — the extra attempt will never be used.",
      remediation_hint: "Either set maxAttempts=1, or add recoverable error codes to retryOn.",
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

// ---------------------------------------------------------------------------
// Rule 5 — Warning Justification
//
// Contract: every warning-severity issue must have an explicit written
// justification in spec.justifications[issue.code].
//
// This rule runs AFTER the other 4 — it receives the already-computed
// warnings and checks whether the designer acknowledged each one.
//
// A missing justification does NOT become an error (that would be circular:
// you'd need to justify why you're not justifying). It stays a warning,
// but with a distinct code so the consumer knows the deviation is
// unacknowledged rather than intentionally accepted.
// ---------------------------------------------------------------------------

export function checkWarningJustifications(
  spec: LoopDesignSpec,
  priorIssues: DesignIssue[]
): DesignIssue[] {
  const issues: DesignIssue[] = []

  const warningCodes = priorIssues
    .filter(i => i.severity === "warning")
    .map(i => i.code)

  for (const code of warningCodes) {
    const justification = spec.justifications?.[code]
    if (!justification || justification.trim() === "") {
      issues.push({
        rule: "warning_justification",
        code: "WARNING_WITHOUT_JUSTIFICATION",
        kind: "heuristic",
        severity: "warning",
        message: `Warning "${code}" has no justification in spec.justifications. Silently accepting a warning is not allowed — record why this deviation is acceptable in this context.`,
        remediation_hint: `Add spec.justifications["${code}"] = "<your rationale>" to record that this deviation is an intentional decision.`,
      })
    }
  }

  return issues
}

export function checkContractEnforcement(spec: LoopDesignSpec): DesignIssue[] {
  const issues: DesignIssue[] = []

  const contractLayers: Array<"syntax" | "structure"> = ["syntax", "structure"]
  const hasContractErrors = spec.errorTypes.some(e => contractLayers.includes(e.layer as "syntax" | "structure"))

  if (hasContractErrors && !spec.verdicts.includes("invalid_output")) {
    issues.push({
      rule: "contract_enforcement",
      code: "CONTRACT_VIOLATIONS_WITHOUT_VERDICT",
      kind: "invariant",
      severity: "error",
      message: "ErrorTypes include syntax or structure layer errors (LLM contract violations) but 'invalid_output' is not in verdicts. Contract violations cannot be distinguished from execution failures.",
      remediation_hint: "Add 'invalid_output' to verdicts to give contract violations a distinct terminal state.",
    })
  }

  // Detect if syntax errors are retried (syntax = LLM ignored the contract completely)
  const syntaxErrors = spec.errorTypes.filter(e => e.layer === "syntax")
  for (const err of syntaxErrors) {
    if (spec.retryPolicy.retryOn.includes(err.code)) {
      issues.push({
        rule: "contract_enforcement",
        code: "SYNTAX_ERROR_RETRIED",
        kind: "heuristic",
        severity: "warning",
        message: `Syntax error "${err.code}" is in retryOn. Syntax failures mean the LLM did not produce parseable output — retry may help for transient issues but should only apply if the error is explicitly marked recoverable=true.`,
        remediation_hint: `Only retry "${err.code}" if recoverable=true. For persistent syntax failures, route to invalid_output instead.`,
      })
    }
  }

  return issues
}
