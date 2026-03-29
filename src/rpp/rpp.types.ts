// src/rpp/rpp.types.ts

export type EvidenceRef = {
  type: "evidence"
  source: string
  locator: string
  supports: string
}

export type RuleRef = {
  type: "rule"
  rule_id: string
  supports: string
}

export type MethodRef = {
  type: "method"
  method_id: string
  supports: string
}

export type Reference = EvidenceRef | RuleRef | MethodRef

export type CognitiveStep = {
  stage: "interpretation" | "reasoning" | "decision" | "action"
  content: string[]
  references: Reference[]
  method_refs?: MethodRef[]
  uncertainties?: string[]
}

export type ResponseStep = {
  content: string[]
  references: Reference[]
}

export type RPPRecord = {
  call_id: string
  session_id?: string
  call_sequence?: number
  steps: CognitiveStep[]
  response: ResponseStep
}

export type RPPFailureCode =
  | "MISSING_STAGE"
  | "EMPTY_CONTENT"
  | "NO_REFERENCES"
  | "UNSUPPORTED_CLAIM"
  | "INFERENCE_AS_FACT"
  | "UNTRACEABLE_RESPONSE"
  | "UNJUSTIFIED_DECISION"
  | "ACTION_SCOPE_VIOLATION"
  | "METHOD_NOT_ACTUALLY_USED"
  | "INVALID_REFERENCE"
  | "SUPPORTS_TOO_VAGUE"
  | "CIRCULAR_REFERENCE"

export type RPPFailure = {
  code: RPPFailureCode
  stage?: CognitiveStep["stage"] | "response"
  detail: string
}

export type RPPValidationResult = {
  overall_status: "valid" | "weakly_supported" | "invalid"
  failures: RPPFailure[]
  warnings: RPPFailure[]
}
