/**
 * Machine-checkable counterpart to .claude/rules/trace-semantics.md.
 *
 * Five trace principles:
 *   1. Causal Completeness    — every event traces back to exactly one root
 *   2. Semantic Precision     — status values are drawn from a declared set
 *   3. Measurement Correctness — durations are non-negative and monotonically increasing
 *   4. Determinism Invariant  — structurally equivalent inputs yield structurally equivalent traces
 *   5. Reconstructability     — any stored trace can fully reconstruct what happened
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

export type NormalizedEvent = {
  type: string
  status: string
  attempt_id: string
  parent_index: number | null
}

// ---------------------------------------------------------------------------
// 1. Causal Completeness
// ---------------------------------------------------------------------------

export function checkCausalCompleteness(
  events: Array<{ event_id: string; parent_event_id?: unknown; type: string }>
): InvariantCheckResult {
  const failures: InvariantFailure[] = []

  // Root events: the key "parent_event_id" must be ABSENT
  const roots = events.filter(e => !("parent_event_id" in e))
  const nonRoots = events.filter(e => "parent_event_id" in e)

  if (roots.length === 0) {
    failures.push({
      code: InvariantCodes.CAUSAL_ROOT_MISSING,
      severity: "error",
      message: "No root event found — every event has a parent_event_id key",
    })
  }

  if (roots.length > 1) {
    failures.push({
      code: InvariantCodes.CAUSAL_MULTIPLE_ROOTS,
      severity: "error",
      message: `${roots.length} root events found — exactly one is required`,
      details: { root_ids: roots.map(e => e.event_id) },
    })
  }

  // Key present but value is null → CAUSAL_NULL_ROOT
  for (const e of nonRoots) {
    if (e.parent_event_id === null) {
      failures.push({
        code: InvariantCodes.CAUSAL_NULL_ROOT,
        severity: "error",
        message: `Event "${e.event_id}" has parent_event_id set to null — use key absence for root events`,
        details: { event_id: e.event_id },
      })
    }
  }

  // Dangling references: parent_event_id is a non-null string but doesn't exist
  const idSet = new Set(events.map(e => e.event_id))
  for (const e of nonRoots) {
    if (typeof e.parent_event_id === "string") {
      if (!idSet.has(e.parent_event_id)) {
        failures.push({
          code: InvariantCodes.CAUSAL_DANGLING_PARENT,
          severity: "error",
          message: `Event "${e.event_id}" references non-existent parent "${e.parent_event_id}"`,
          details: { dangling_id: e.event_id, referenced_parent: e.parent_event_id },
        })
      }
    }
  }

  if (failures.length > 0) {
    return fail(...failures)
  }
  return pass()
}

// ---------------------------------------------------------------------------
// 2. Semantic Precision
// ---------------------------------------------------------------------------

export function checkSemanticPrecision(
  statusValues: string[],
  allowedStatuses: string[]
): InvariantCheckResult {
  const allowed = new Set(allowedStatuses)
  const failures: InvariantFailure[] = []

  for (const value of statusValues) {
    if (!allowed.has(value)) {
      failures.push({
        code: InvariantCodes.SEMANTIC_UNKNOWN_STATUS,
        severity: "error",
        message: `Status value "${value}" is not in the declared allowed set: [${allowedStatuses.join(", ")}]`,
        details: { unknown_status: value },
      })
    }
  }

  if (failures.length > 0) {
    return fail(...failures)
  }
  return pass()
}

// ---------------------------------------------------------------------------
// 3. Measurement Correctness
// ---------------------------------------------------------------------------

export function checkMeasurementCorrectness(
  events: Array<{ type: string; duration_ms: number; attempt_id: string }>
): InvariantCheckResult {
  const failures: InvariantFailure[] = []

  // Group by attempt_id while preserving original array order
  const groups = new Map<string, Array<{ type: string; duration_ms: number; attempt_id: string }>>()
  for (const e of events) {
    const group = groups.get(e.attempt_id) ?? []
    group.push(e)
    groups.set(e.attempt_id, group)
  }

  for (const [attempt_id, group] of groups) {
    for (let i = 0; i < group.length; i++) {
      const e = group[i]

      // Negative duration
      if (e.duration_ms < 0) {
        failures.push({
          code: InvariantCodes.MEASUREMENT_NEGATIVE_DURATION,
          severity: "error",
          message: `Event at position ${i} in attempt "${attempt_id}" has negative duration_ms: ${e.duration_ms}`,
          details: { attempt_id, position: i, duration_ms: e.duration_ms },
        })
      }

      // First event baseline
      if (i === 0 && e.duration_ms !== 0) {
        failures.push({
          code: InvariantCodes.MEASUREMENT_NONZERO_ROOT,
          severity: "warning",
          message: `First event in attempt "${attempt_id}" has non-zero duration_ms: ${e.duration_ms}`,
          details: { attempt_id, duration_ms: e.duration_ms },
        })
      }

      // Monotonic check
      if (i > 0 && e.duration_ms < group[i - 1].duration_ms) {
        failures.push({
          code: InvariantCodes.MEASUREMENT_NONMONOTONIC,
          severity: "error",
          message: `Event at position ${i} in attempt "${attempt_id}" has lower duration_ms (${e.duration_ms}) than previous (${group[i - 1].duration_ms})`,
          details: {
            attempt_id,
            position: i,
            current: e.duration_ms,
            previous: group[i - 1].duration_ms,
          },
        })
      }
    }
  }

  if (failures.some(f => f.severity === "error")) {
    return { ok: false, failures }
  }
  if (failures.length > 0) {
    // warnings only
    return { ok: true, failures }
  }
  return pass()
}

// ---------------------------------------------------------------------------
// 4. Determinism Invariant
// ---------------------------------------------------------------------------

export function checkDeterminismInvariant(
  traceA: NormalizedEvent[],
  traceB: NormalizedEvent[]
): InvariantCheckResult {
  const failures: InvariantFailure[] = []

  if (traceA.length !== traceB.length) {
    failures.push({
      code: InvariantCodes.DETERMINISM_LENGTH_MISMATCH,
      severity: "error",
      message: `Traces have different lengths: ${traceA.length} vs ${traceB.length}`,
      details: { length_a: traceA.length, length_b: traceB.length },
    })
    return fail(...failures)
  }

  for (let i = 0; i < traceA.length; i++) {
    const a = traceA[i]
    const b = traceB[i]

    if (a.type !== b.type) {
      failures.push({
        code: InvariantCodes.DETERMINISM_TYPE_MISMATCH,
        severity: "error",
        message: `Type differs at position ${i}: "${a.type}" vs "${b.type}"`,
        details: { position: i, type_a: a.type, type_b: b.type },
      })
    }

    if (a.status !== b.status) {
      failures.push({
        code: InvariantCodes.DETERMINISM_STATUS_MISMATCH,
        severity: "error",
        message: `Status differs at position ${i}: "${a.status}" vs "${b.status}"`,
        details: { position: i, status_a: a.status, status_b: b.status },
      })
    }

    if (a.parent_index !== b.parent_index) {
      failures.push({
        code: InvariantCodes.DETERMINISM_PARENT_MISMATCH,
        severity: "error",
        message: `Parent index differs at position ${i}: ${a.parent_index} vs ${b.parent_index}`,
        details: { position: i, parent_a: a.parent_index, parent_b: b.parent_index },
      })
    }
  }

  // Attempt grouping check: sets of attempt_id values must match
  const attemptsA = new Set(traceA.map(e => e.attempt_id))
  const attemptsB = new Set(traceB.map(e => e.attempt_id))
  const onlyInA = [...attemptsA].filter(id => !attemptsB.has(id))
  const onlyInB = [...attemptsB].filter(id => !attemptsA.has(id))

  if (onlyInA.length > 0 || onlyInB.length > 0) {
    failures.push({
      code: InvariantCodes.DETERMINISM_GROUPING_MISMATCH,
      severity: "error",
      message: "Attempt grouping differs between traces",
      details: { only_in_a: onlyInA, only_in_b: onlyInB },
    })
  }

  if (failures.length > 0) {
    return fail(...failures)
  }
  return pass()
}

// ---------------------------------------------------------------------------
// 5. Reconstructability
// ---------------------------------------------------------------------------

type ReconstructabilityEvent = {
  event_id: string
  parent_event_id?: unknown
  type: string
  status: string
  duration_ms: number
  attempt_id: string
  payload: Record<string, unknown>
}

export function checkReconstructability(
  events: ReconstructabilityEvent[]
): InvariantCheckResult {
  const results: InvariantCheckResult[] = []

  // Run sub-checks
  results.push(checkCausalCompleteness(events))
  results.push(checkMeasurementCorrectness(events))

  const additionalFailures: InvariantFailure[] = []

  // Empty payload
  for (const e of events) {
    if (Object.keys(e.payload).length === 0) {
      additionalFailures.push({
        code: InvariantCodes.RECONSTRUCTABILITY_EMPTY_PAYLOAD,
        severity: "error",
        message: `Event "${e.event_id}" has an empty payload — cannot reconstruct what happened`,
        details: { event_id: e.event_id },
      })
    }
  }

  // final_verdict must be last
  const verdictIndices = events
    .map((e, i) => ({ type: e.type, index: i }))
    .filter(e => e.type === "final_verdict")

  for (const v of verdictIndices) {
    if (v.index !== events.length - 1) {
      additionalFailures.push({
        code: InvariantCodes.RECONSTRUCTABILITY_VERDICT_NOT_LAST,
        severity: "error",
        message: `Event at position ${v.index} has type "final_verdict" but is not the last event`,
        details: { position: v.index, total: events.length },
      })
    }
  }

  if (additionalFailures.length > 0) {
    results.push(fail(...additionalFailures))
  }

  return mergeResults(results)
}

// ---------------------------------------------------------------------------
// Entry point: check all principles (single-trace mode)
// ---------------------------------------------------------------------------

type TracePrinciplesEvent = {
  event_id: string
  parent_event_id?: unknown
  type: string
  status: string
  duration_ms: number
  attempt_id: string
  payload: Record<string, unknown>
}

export function checkAllTracePrinciples(
  events: TracePrinciplesEvent[],
  options?: { allowedStatuses?: string[] }
): InvariantCheckResult {
  const statusValues = events.map(e => e.status)
  const allowedStatuses = options?.allowedStatuses ?? ["pass", "fail", "skip"]

  const results: InvariantCheckResult[] = [
    checkCausalCompleteness(events),
    checkSemanticPrecision(statusValues, allowedStatuses),
    checkMeasurementCorrectness(events),
    // checkDeterminismInvariant requires two traces — skipped in single-trace mode
    checkReconstructability(events),
  ]

  return mergeResults(results)
}

// ---------------------------------------------------------------------------
// Helper: normalizeTrace
// ---------------------------------------------------------------------------

export function normalizeTrace(
  events: Array<{
    event_id: string
    parent_event_id?: string
    type: string
    status: string
    attempt_id: string
  }>
): NormalizedEvent[] {
  const idToIndex = new Map<string, number>()
  for (let i = 0; i < events.length; i++) {
    idToIndex.set(events[i].event_id, i)
  }

  return events.map(e => {
    const parent_index =
      "parent_event_id" in e && typeof e.parent_event_id === "string"
        ? (idToIndex.get(e.parent_event_id) ?? null)
        : null

    return {
      type: e.type,
      status: e.status,
      attempt_id: e.attempt_id,
      parent_index,
    }
  })
}
