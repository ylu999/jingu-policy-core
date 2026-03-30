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
import { checkStateMachineCompleteness } from "./rules.js"
import { checkLayerSeparation } from "./rules.js"
import { checkRecoverability } from "./rules.js"
import { checkContractEnforcement } from "./rules.js"

export { checkStateMachineCompleteness, checkLayerSeparation, checkRecoverability, checkContractEnforcement }

export function lintLoopDesign(spec: LoopDesignSpec): DesignIssue[] {
  if (spec == null) throw new Error("lintLoopDesign: spec is required")
  return [
    ...checkStateMachineCompleteness(spec),
    ...checkLayerSeparation(spec),
    ...checkRecoverability(spec),
    ...checkContractEnforcement(spec),
  ]
}

/** Convenience: returns true if the spec has no error-severity issues. */
export function isDesignValid(spec: LoopDesignSpec): boolean {
  return lintLoopDesign(spec).every(i => i.severity !== "error")
}
