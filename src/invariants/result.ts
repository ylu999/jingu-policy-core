import type { InvariantSeverity } from "./codes.js"

export type InvariantFailure = {
  code: string
  severity: InvariantSeverity
  message: string
  path?: string
  details?: Record<string, unknown>
}

export type InvariantCheckResult = {
  ok: boolean
  failures: InvariantFailure[]
}

export function pass(): InvariantCheckResult {
  return { ok: true, failures: [] }
}

export function fail(...failures: InvariantFailure[]): InvariantCheckResult {
  return { ok: false, failures }
}

export function mergeResults(results: InvariantCheckResult[]): InvariantCheckResult {
  const failures = results.flatMap(r => r.failures)
  const hasError = failures.some(f => f.severity === "error")
  return { ok: !hasError, failures }
}
