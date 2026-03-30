import { InvariantCodes } from "./codes.js"
import { pass, fail, mergeResults, type InvariantCheckResult } from "./result.js"

// Non-final event types (events that should carry an attempt_id)
const FINAL_EVENT_TYPES = new Set(["final_verdict"])

// Gate event types (events that should carry a status field)
const GATE_EVENT_TYPES = new Set([
  "rpp_schema_checked",
  "rpp_binding_checked",
  "rpp_strictness_checked",
  "reviewer_evaluated",
])

export function checkLoopEventHasAttemptId(
  event: { type: string; attempt_id?: string }
): InvariantCheckResult {
  if (!FINAL_EVENT_TYPES.has(event.type) && !event.attempt_id) {
    return fail({
      code: InvariantCodes.MISSING_ATTEMPT_ID,
      severity: "warning",
      message: `Event of type '${event.type}' is missing attempt_id. Non-final events should carry attempt_id for traceability.`,
      details: { event_type: event.type },
    })
  }
  return pass()
}

export function checkLoopEventHasStatus(
  event: { type: string; status?: string }
): InvariantCheckResult {
  if (GATE_EVENT_TYPES.has(event.type) && !event.status) {
    return fail({
      code: InvariantCodes.MISSING_EVENT_STATUS,
      severity: "warning",
      message: `Gate event of type '${event.type}' is missing status. Gate events should report pass/fail/skip.`,
      details: { event_type: event.type },
    })
  }
  return pass()
}

export function checkLoopEventSequence(
  events: Array<{ type: string; attempt_id?: string }>
): InvariantCheckResult {
  // Group events by attempt_id
  const attemptIds = new Set<string>()
  const startedAttempts = new Set<string>()

  for (const event of events) {
    if (event.attempt_id) {
      attemptIds.add(event.attempt_id)
    }
    if (event.type === "attempt_started" && event.attempt_id) {
      startedAttempts.add(event.attempt_id)
    }
  }

  const results: InvariantCheckResult[] = []

  // Every attempt_id referenced in events must have a corresponding attempt_started
  for (const id of attemptIds) {
    if (!startedAttempts.has(id)) {
      results.push(fail({
        code: InvariantCodes.INVALID_EVENT_SEQUENCE,
        severity: "error",
        message: `Events reference attempt_id '${id}' but no attempt_started event was found for it.`,
        details: { missing_attempt_started_for: id },
      }))
    }
  }

  // retry_requested must not appear before attempt_started for the same attempt_id
  const startedOrder = new Map<string, number>()
  events.forEach((event, index) => {
    if (event.type === "attempt_started" && event.attempt_id) {
      startedOrder.set(event.attempt_id, index)
    }
  })

  events.forEach((event, index) => {
    if (event.type === "retry_requested" && event.attempt_id) {
      const startedAt = startedOrder.get(event.attempt_id)
      if (startedAt === undefined || index < startedAt) {
        results.push(fail({
          code: InvariantCodes.INVALID_EVENT_SEQUENCE,
          severity: "error",
          message: `retry_requested event appeared before attempt_started for attempt_id '${event.attempt_id}'.`,
          details: { event_type: "retry_requested", attempt_id: event.attempt_id },
        }))
      }
    }
  })

  if (results.length === 0) return pass()
  return mergeResults(results)
}
