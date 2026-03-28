import { p1ConstraintObedience } from "./discipline/p1-constraint-obedience"
import { p2Preconditions } from "./discipline/p2-preconditions"
import { p3FailureClassification } from "./discipline/p3-failure-classification"
import { p4GlobalInvariants } from "./discipline/p4-global-invariants"
import { p5RespectAuthority } from "./discipline/p5-respect-authority"
import { p6BoundedExecution } from "./discipline/p6-bounded-execution"
import { p7Hygiene } from "./discipline/p7-hygiene"
import { p8ClaimHonesty } from "./discipline/p8-claim-honesty"
import { p9HypothesisSearch } from "./discipline/p9-hypothesis-search"
import { p10CoreTension } from "./senior/p10-core-tension"
import { p11LayerDiagnosis } from "./senior/p11-layer-diagnosis"
import { p12SymptomRootCause } from "./senior/p12-symptom-root-cause"
import { p13Tradeoff } from "./senior/p13-tradeoff"
import { p14MinimalIntervention } from "./senior/p14-minimal-intervention"
import { p15FutureIntegrity } from "./senior/p15-future-integrity"
import { p16ExternalizeContext } from "./senior/p16-externalize-context"
import { Policy } from "../types"

// Named policy exports (P1–P15)
export const P1: Policy = p1ConstraintObedience
export const P2: Policy = p2Preconditions
export const P3: Policy = p3FailureClassification
export const P4: Policy = p4GlobalInvariants
export const P5: Policy = p5RespectAuthority
export const P6: Policy = p6BoundedExecution
export const P7: Policy = p7Hygiene
export const P8: Policy = p8ClaimHonesty
export const P9: Policy = p9HypothesisSearch
export const P10: Policy = p10CoreTension
export const P11: Policy = p11LayerDiagnosis
export const P12: Policy = p12SymptomRootCause
export const P13: Policy = p13Tradeoff
export const P14: Policy = p14MinimalIntervention
export const P15: Policy = p15FutureIntegrity
export const P16: Policy = p16ExternalizeContext

// Named function exports (camelCase)
export {
  p1ConstraintObedience,
  p2Preconditions,
  p3FailureClassification,
  p4GlobalInvariants,
  p5RespectAuthority,
  p6BoundedExecution,
  p7Hygiene,
  p8ClaimHonesty,
  p9HypothesisSearch,
  p10CoreTension,
  p11LayerDiagnosis,
  p12SymptomRootCause,
  p13Tradeoff,
  p14MinimalIntervention,
  p15FutureIntegrity,
  p16ExternalizeContext,
}

// Discipline policies (P1-P9)
export const disciplinePolicies: Policy[] = [
  P1, P2, P3, P4, P5, P6, P7, P8, P9,
]

// Senior engineering policies (P10-P16)
export const seniorPolicies: Policy[] = [
  P10, P11, P12, P13, P14, P15, P16,
]

// All policies combined
export const allPolicies: Policy[] = [
  ...disciplinePolicies,
  ...seniorPolicies,
]
