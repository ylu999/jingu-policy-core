/**
 * Machine-checkable counterpart to .claude/rules/eval-alignment.md
 *
 * Eight evaluation alignment principles:
 *   EA1 — True Evaluation Boundary First
 *   EA2 — No Default Run Pattern
 *   EA3 — Evaluation Loop Before Agent Optimization
 *   EA4 — Failure Layer Classification
 *   EA5 — Fallbacks Preserve Liveness, Not Truth
 *   EA6 — Evaluation Semantics Must Be Declared
 *   EA7 — Document Check Before Implementation (behavioral — not runtime-checkable)
 *   EA8 — Separate Observation Gate from Quality Gate
 */

import {
  type InvariantCheckResult,
  type InvariantFailure,
  pass,
  fail,
  mergeResults,
} from "../invariants/index.js"
import { InvariantCodes } from "../invariants/codes.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Declared evaluation method for a run or result. */
export type EvaluationMethod =
  | "official_harness"    // swebench.harness.run_evaluation or sb-cli
  | "docker_pytest"       // pytest inside correct Docker container
  | "local_pytest"        // pytest on local machine (may lack C extensions)
  | "apply_gate_only"     // only patch-apply checked, no test execution
  | "unknown"

/** Failure layer classification per EA4. */
export type FailureLayer =
  | "task_failure"         // patch is genuinely wrong
  | "environment_failure"  // deps/container/cwd missing
  | "harness_mismatch"     // wrong evaluator used
  | "observation_failure"  // insufficient data to classify

/** A run result with evaluation metadata. */
export type EvalResult = {
  instance_id: string
  verdict: "accepted" | "rejected" | "uncertain"
  evaluation_method: EvaluationMethod
  failure_layer?: FailureLayer       // required when verdict is "rejected" or "uncertain"
  is_fallback?: boolean              // true when accepted via degraded gate
  fallback_reason?: string           // required when is_fallback is true
}

/** A quality gate result (only meaningful when observation gate passed). */
export type QualityGateResult = {
  observation_confirmed: boolean     // was the observation gate confirmed first?
  tests_pass: boolean
  failure_layer?: FailureLayer
}

// ---------------------------------------------------------------------------
// EA4: Failure Layer Classification
// ---------------------------------------------------------------------------

/** EA4: Every rejected result must have a declared failure layer. */
export function checkFailureLayerDeclared(results: EvalResult[]): InvariantCheckResult {
  const failures: InvariantFailure[] = []

  for (const r of results) {
    if ((r.verdict === "rejected" || r.verdict === "uncertain") && !r.failure_layer) {
      failures.push({
        code: InvariantCodes.EVAL_MISSING_FAILURE_LAYER,
        message: `Result for ${r.instance_id} has verdict '${r.verdict}' but no failure_layer declared`,
        severity: "error",
        path: `instance_id=${r.instance_id}`,
      })
    }
  }

  return failures.length > 0 ? fail(...failures) : pass()
}

// ---------------------------------------------------------------------------
// EA5: Fallbacks Labeled, Not Promoted
// ---------------------------------------------------------------------------

/** EA5: Fallback results must be labeled distinctly and not mixed with full results. */
export function checkFallbackLabeling(results: EvalResult[]): InvariantCheckResult {
  const failures: InvariantFailure[] = []

  for (const r of results) {
    // Fallback must have a reason
    if (r.is_fallback && !r.fallback_reason) {
      failures.push({
        code: InvariantCodes.EVAL_FALLBACK_UNLABELED,
        message: `Fallback result for ${r.instance_id} has no fallback_reason`,
        severity: "error",
        path: `instance_id=${r.instance_id}`,
      })
    }
    // apply_gate_only results must be flagged as fallback
    if (r.evaluation_method === "apply_gate_only" && r.verdict === "accepted" && !r.is_fallback) {
      failures.push({
        code: InvariantCodes.EVAL_FALLBACK_PROMOTED,
        message: `Result for ${r.instance_id} uses apply_gate_only but is not marked is_fallback`,
        severity: "error",
        path: `instance_id=${r.instance_id}`,
      })
    }
  }

  return failures.length > 0 ? fail(...failures) : pass()
}

// ---------------------------------------------------------------------------
// EA6: Evaluation Semantics Declared
// ---------------------------------------------------------------------------

/** EA6: Every result must declare its evaluation method. Unknown is flagged as warning. */
export function checkEvaluationMethodDeclared(results: EvalResult[]): InvariantCheckResult {
  const failures: InvariantFailure[] = []

  for (const r of results) {
    if (!r.evaluation_method || r.evaluation_method === "unknown") {
      failures.push({
        code: InvariantCodes.EVAL_METHOD_UNDECLARED,
        message: `Result for ${r.instance_id} has no declared evaluation_method`,
        severity: "warning",
        path: `instance_id=${r.instance_id}`,
      })
    }
  }

  return failures.length > 0 ? fail(...failures) : pass()
}

// ---------------------------------------------------------------------------
// EA8: Observation Gate Separate from Quality Gate
// ---------------------------------------------------------------------------

/** EA8: Quality gate must not evaluate when observation gate was not confirmed. */
export function checkObservationGateSeparate(quality: QualityGateResult): InvariantCheckResult {
  if (!quality.observation_confirmed) {
    return fail({
      code: InvariantCodes.EVAL_QUALITY_WITHOUT_OBSERVATION,
      message: "Quality gate was evaluated without confirming observation gate first",
      severity: "error",
      path: "quality_gate",
    })
  }
  return pass()
}

// ---------------------------------------------------------------------------
// Composite: check all runtime-verifiable EA principles
// ---------------------------------------------------------------------------

export function checkAllEvalAlignmentPrinciples(
  results: EvalResult[],
): InvariantCheckResult {
  return mergeResults([
    checkFailureLayerDeclared(results),     // EA4
    checkFallbackLabeling(results),          // EA5
    checkEvaluationMethodDeclared(results),  // EA6
    // EA8 checked per-gate, not at aggregate level
  ])
}
