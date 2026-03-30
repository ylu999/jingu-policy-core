// src/linter/types.ts
// Jingu Design Linter — type definitions
//
// LoopDesignSpec is the intermediate representation (IR) for a governed loop
// design. It captures enough structure to verify the 4 system invariants:
//
//   1. State Machine Completeness — all paths reach a deterministic verdict
//   2. Layer Separation — syntax/structure/semantics/execution errors stay distinct
//   3. Recoverability — retry only fires on recoverable errors
//   4. Contract Enforcement — LLM contract violations map to invalid_output
//
// The linter consumes LoopDesignSpec and emits DesignIssue[].

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

export type IssueSeverity = "error" | "warning"

export interface DesignIssue {
  rule: string        // which invariant this violates
  code: string        // machine-readable code
  severity: IssueSeverity
  message: string
}
