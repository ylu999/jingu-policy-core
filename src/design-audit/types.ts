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
}

export type IssueSeverity = "error" | "warning" | "info"

export interface DesignIssue {
  rule: string        // which invariant this violates
  code: string        // machine-readable code
  severity: IssueSeverity
  message: string
}
