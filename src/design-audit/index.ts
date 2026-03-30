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

export function lintLoopDesign(spec: LoopDesignSpec): DesignIssue[] {
  if (spec == null) throw new Error("lintLoopDesign: spec is required")
  const priorIssues = [
    ...checkStateMachineCompleteness(spec),
    ...checkLayerSeparation(spec),
    ...checkRecoverability(spec),
    ...checkContractEnforcement(spec),
  ]
  return [
    ...priorIssues,
    ...checkWarningJustifications(spec, priorIssues),
  ]
}

/** Convenience: returns true if the spec has no error-severity issues. */
export function isDesignValid(spec: LoopDesignSpec): boolean {
  return lintLoopDesign(spec).every(i => i.severity !== "error")
}
