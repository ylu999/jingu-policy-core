// src/linter/index.ts
// Jingu Design Linter — public API
//
// lintLoopDesign(spec) runs all 4 invariant checks and returns the union of issues.
// An empty array means the design is well-formed.
//
// Usage:
//   import { lintLoopDesign } from "@jingu/policy-core"
//   const issues = lintLoopDesign(mySpec)
//   if (issues.some(i => i.severity === "error")) { ... }

export type { LoopDesignSpec, DesignIssue, ErrorTypeSpec, RetryPolicy, LoopStage, ErrorLayer, LoopVerdict, IssueSeverity } from "./types.js"

import type { LoopDesignSpec, DesignIssue } from "./types.js"
import { checkStateMachineCompleteness, checkLayerSeparation, checkRecoverability, checkContractEnforcement, checkWarningJustifications } from "./rules.js"

export { checkStateMachineCompleteness, checkLayerSeparation, checkRecoverability, checkContractEnforcement, checkWarningJustifications }

const SEVERITY_ORDER: Record<string, number> = { error: 0, warning: 1, info: 2 }

export function lintLoopDesign(spec: LoopDesignSpec): DesignIssue[] {
  if (spec == null) throw new Error("lintLoopDesign: spec is required")
  const priorIssues = [
    ...checkStateMachineCompleteness(spec),
    ...checkLayerSeparation(spec),
    ...checkRecoverability(spec),
    ...checkContractEnforcement(spec),
  ]
  const allIssues = [
    ...priorIssues,
    ...checkWarningJustifications(spec, priorIssues),
  ]
  // Deterministic output order: severity → rule → code
  // Guarantees stable snapshot tests and machine-readable output across runs.
  return allIssues.sort((a, b) => {
    const sv = (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
    if (sv !== 0) return sv
    if (a.rule < b.rule) return -1
    if (a.rule > b.rule) return 1
    if (a.code < b.code) return -1
    if (a.code > b.code) return 1
    return 0
  })
}

/** Convenience: returns true if the spec has no error-severity issues. */
export function isDesignValid(spec: LoopDesignSpec): boolean {
  return lintLoopDesign(spec).every(i => i.severity !== "error")
}
