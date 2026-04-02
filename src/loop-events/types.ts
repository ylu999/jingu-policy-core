// CORE INVARIANT:
// Events are system-generated facts, never LLM self-descriptions.
// Every field must be derived from system state, not from LLM output.
// A rpp_binding_checked event records what the validator found, not what the LLM claimed.

export type LoopEventType =
  | "attempt_started"
  | "rpp_schema_checked"
  | "rpp_binding_checked"
  | "rpp_strictness_checked"
  | "reviewer_evaluated"
  | "retry_requested"
  | "final_verdict"
  | "principle_evaluated"
  | "cognition_evaluated"

export interface LoopEventBase {
  event_id: string           // globally unique (crypto.randomUUID())
  run_id: string             // groups all events for one runGovernedLoop() call
  attempt_id: string         // groups events within one attempt (e.g. "run-123-a1")
  parent_event_id?: string   // causality chain — OMIT for root event, never null
  type: LoopEventType
  timestamp: string          // ISO 8601
  status: "pass" | "fail" | "skip"  // top-level outcome; skip = gate not applicable
  duration_ms: number        // ms since attempt_id started; 0 for attempt_started
  payload: Record<string, unknown>
}

// Typed payload interfaces
export interface AttemptStartedPayload { attempt: number; max_attempts: number }
export interface RppSchemaCheckedPayload { valid: boolean; error_code?: string }
export interface RppBindingCheckedPayload { binding_valid: boolean; error_codes: string[]; checked_refs: number; unbound_refs: number }
export interface RppStrictnessCheckedPayload { strictness_pass: boolean; warning_codes: string[] }
export interface ReviewerEvaluatedPayload { verdict: "pass" | "reject"; issues: string[] }
export interface RetryRequestedPayload { attempt: number; reason: string; recoverable: boolean; binding_error_codes: string[] }
export interface FinalVerdictPayload { verdict: "pass" | "fail" | "reject" | "invalid_output"; reason: string; total_attempts: number }

// Discriminated union — each event type has specific payload
export type LoopEvent =
  | (LoopEventBase & { type: "attempt_started"; payload: AttemptStartedPayload })
  | (LoopEventBase & { type: "rpp_schema_checked"; payload: RppSchemaCheckedPayload })
  | (LoopEventBase & { type: "rpp_binding_checked"; payload: RppBindingCheckedPayload })
  | (LoopEventBase & { type: "rpp_strictness_checked"; payload: RppStrictnessCheckedPayload })
  | (LoopEventBase & { type: "reviewer_evaluated"; payload: ReviewerEvaluatedPayload })
  | (LoopEventBase & { type: "retry_requested"; payload: RetryRequestedPayload })
  | (LoopEventBase & { type: "final_verdict"; payload: FinalVerdictPayload })
  | (LoopEventBase & { type: "principle_evaluated"; payload: PrincipleEvaluatedPayload })
  | (LoopEventBase & { type: "cognition_evaluated"; payload: CognitionEvaluatedPayload })

export interface EventSink {
  emit(event: LoopEvent): void
  flush?(): Promise<void>
}

export const noopEventSink: EventSink = {
  emit(_event: LoopEvent): void {},
  flush(): Promise<void> { return Promise.resolve() },
}

// principle_evaluated — emitted after PEB gate runs (pass or fail)
export interface PrincipleEvaluatedPayload {
  claims_count: number
  passed: number
  failed: number
  failures: Array<{ principle_id: string; code: string; reason: string }>
}

// cognition_evaluated — emitted after cognition gate runs (type-principal + declaration-patch)
export interface CognitionEvaluatedPayload {
  type: string
  principals: string[]
  patch_signals: string[]
  valid: boolean
  violations: Array<{ kind: string; reason: string }>
}
