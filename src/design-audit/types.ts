// src/design-audit/types.ts
// Jingu Design Audit — type definitions
//
// LoopDesignSpec is the intermediate representation (IR) for a governed loop
// design. It captures enough structure to verify the 4 system invariants:
//
//   1. State Machine Completeness — all paths reach a deterministic verdict
//   2. Layer Separation — syntax/structure/semantics/execution errors stay distinct
//   3. Recoverability — retry only fires on recoverable errors
//   4. Contract Enforcement — LLM contract violations map to invalid_output
//
// The audit consumes LoopDesignSpec and emits DesignIssue[].
//
// ---------------------------------------------------------------------------
// Severity model (enforcement contract)
// ---------------------------------------------------------------------------
//
//   error   — Violates a system invariant. Blocks implementation.
//             isDesignValid() returns false. Must be fixed before any code is written.
//
//   warning — Violates a recommended pattern (heuristic). Does NOT block implementation,
//             but requires an explicit written justification in the design record
//             (ADR or equivalent). Silently ignoring warnings is not allowed.
//
//   info    — Non-blocking observation for visibility only. No action required.
//             Reserved for future observability hooks (Unit 2.3+).
//
// Enforcement:
//   isDesignValid(spec) := lintLoopDesign(spec).every(i => i.severity !== "error")

export type LoopStage =
  | "proposer"
  | "binding_validator"
  | "strictness"
  | "reviewer"
  | "gates"

export type ErrorLayer = "syntax" | "structure" | "semantics" | "execution"

export type LoopVerdict = "pass" | "fail" | "reject" | "invalid_output"

export interface ErrorTypeSpec {
  code: string
  layer: ErrorLayer
  recoverable: boolean
}

export interface RetryPolicy {
  maxAttempts: number
  retryOn: string[]  // error type codes that trigger retry
}

export interface LoopDesignSpec {
  attempts: number
  stages: LoopStage[]
  verdicts: LoopVerdict[]
  retryPolicy: RetryPolicy
  errorTypes: ErrorTypeSpec[]
  /**
   * Explicit justifications for accepted warning-severity issues.
   * Keys are DesignIssue.code values; values are the written rationale.
   *
   * Required by the WARNING_WITHOUT_JUSTIFICATION rule:
   * every warning-severity issue emitted by lintLoopDesign must have a
   * corresponding entry here, or a second-order warning is emitted.
   *
   * This turns "warning = allowed" into "warning = traceable decision".
   */
  justifications?: Record<string, string>
}

export type IssueSeverity = "error" | "warning" | "info"

/**
 * RuleKind — the nature of the rule that produced an issue.
 *
 *   invariant    — a system correctness property. Violation means the system
 *                  can produce incorrect or undefined behavior. Maps to "error".
 *
 *   heuristic    — a quality recommendation backed by experience. Violation
 *                  is allowed but must be explicitly justified. Maps to "warning".
 *
 *   observation  — a non-blocking signal for visibility. Maps to "info".
 */
export type RuleKind = "invariant" | "heuristic" | "observation"

/**
 * Stable public issue codes — treated as a public contract.
 *
 * Once emitted in a release, codes must not be renamed or removed.
 * Consumers build justification maps, CI policies, and dashboards on these.
 * To deprecate a code: keep emitting it, add a note in the message.
 *
 * Current codes:
 *   Rule 1 — State Machine Completeness
 *     INVALID_RETRY_POLICY            (invariant / error)
 *     UNBOUNDED_RETRY_RISK            (heuristic / warning)
 *     MISSING_INVALID_OUTPUT_VERDICT  (invariant / error)
 *     REVIEWER_BEFORE_BINDING         (invariant / error)
 *
 *   Rule 2 — Layer Separation
 *     SEMANTICS_WITHOUT_STRUCTURE_GATE  (invariant / error)
 *     MIXED_LAYER_RETRY                 (heuristic / warning)
 *
 *   Rule 3 — Recoverability
 *     UNDEFINED_RETRY_CODE     (invariant / error)
 *     NON_RECOVERABLE_RETRY    (invariant / error)
 *     RETRY_WITH_NO_TRIGGER    (heuristic / warning)
 *
 *   Rule 4 — Contract Enforcement
 *     CONTRACT_VIOLATIONS_WITHOUT_VERDICT  (invariant / error)
 *     SYNTAX_ERROR_RETRIED                 (heuristic / warning)
 *
 *   Rule 5 — Warning Justification
 *     WARNING_WITHOUT_JUSTIFICATION  (heuristic / warning)
 */
export interface DesignIssue {
  rule: string             // which invariant this violates
  code: string             // machine-readable code (stable public contract — never rename)
  kind: RuleKind           // invariant | heuristic | observation
  severity: IssueSeverity
  message: string
  remediation_hint?: string  // what to do next (not auto-fix, just guidance)
}
