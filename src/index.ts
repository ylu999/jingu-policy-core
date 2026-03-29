export type {
  Severity,
  Violation,
  ProblemLayer,
  Action,
  Proposal,
  Evidence,
  EvidenceType,
  TypedEvidenceItem,
  Claim,
  ClaimType,
  TypedClaim,
  TypedPolicy,
  ReasoningFrame,
  TaskContract,
  DiscoveryType,
  Discovery,
  ExecutionBudget,
  Input,
  Policy,
} from "./types"

export {
  P1, P2, P3, P4, P5, P6, P7, P8, P9,
  P10, P11, P12, P13, P14, P15, P16, P17, P18, P19,
  disciplinePolicies,
  seniorPolicies,
  allPolicies,
} from "./policies"

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
} from "./policies/discipline"

export {
  p10CoreTension,
  p11LayerDiagnosis,
  p12SymptomRootCause,
  p13Tradeoff,
  p14MinimalIntervention,
  p15FutureIntegrity,
  p16ExternalizeContext,
  p17ExternalizeOnDiscovery,
  p18BlockerPrecedence,
  p19ContextBudget,
} from "./policies/senior"

export { enforceReasoningFrame } from "./reasoning-gate"
export type { ReasoningGateResult } from "./reasoning-gate"

export { checkReasoningCoherence } from "./coherence-check"
export type {
  CoherenceIssue,
  CoherenceResult,
  CoherenceJudge,
  CoherenceJudgeInput,
  CoherenceJudgeResult,
} from "./coherence-check"

export {
  evaluateV4,
  evaluateV4Sync,
  evaluateV4WithTyped,
  runTypedPolicies,
  gradeFromScore,
  scoreFromViolations,
  decideFromViolations,
} from "./evaluate-v4"
export type { V4StageResult, V4RegimeResult, V4ReasoningRejectResult, Grade } from "./evaluate-v4"

export { evaluateV5, evaluateV5WithJudgement } from "./evaluate-v5"
export type {
  CoherenceJudgement,
  V5SemanticResult,
  V5StageResult,
  RichCoherenceJudge,
} from "./evaluate-v5"

export * from "./rpp/rpp.types.js"
export * from "./rpp/rpp.failures.js"
export { validateRPP } from "./rpp/rpp.validate.js"

export {
  resolvePolicies,
} from "./resolver/policy-resolver"
export type {
  TaskType,
  RiskLevel,
  ExecutionMode,
  ReviewerMode,
  TaskContext,
  PolicyPack,
  ExecutionConfig,
} from "./resolver/policy-resolver"
