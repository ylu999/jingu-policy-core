/**
 * Machine-checkable counterpart to .claude/rules/cognition-consistency.md
 *
 * Five principles for cognition layer consistency:
 *   CC1 — Canonical Ontology: phase/subtype/principal names from one authoritative source
 *   CC2 — Evaluated-Only Inference: inferrable ⊆ rules-that-ran, not full registry
 *   CC3 — Contract Executability: every required_principal has a matching inference rule or stage<fake_checkable
 *   CC4 — Subtype is First-Class: subtype=unknown must not reach the gate
 *   CC5 — Inference Transparency: every non-inferred principal must have a logged reason
 *
 * Origin: jingu-swebench p202 incident (2026-04-06).
 * phase_record.phase="EXECUTION" vs _PHASE_SUBTYPE_MAP key "EXECUTE" caused subtype=unknown
 * → minimal_change inference rule not triggered → declared principal falsely flagged as fake
 * → incorrect RETRYABLE routing.
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

/** A phase record as seen by the cognition gate. */
export type PhaseRecordInput = {
  phase: string       // e.g. "EXECUTE", "ANALYZE"
  subtype: string     // e.g. "execution.code_patch", "unknown"
  principals: string[]
}

/**
 * An inference rule entry — minimal representation for CC2/CC3 checks.
 * applies_to: null means all subtypes; non-null means only those subtypes.
 */
export type InferenceRuleEntry = {
  principal: string
  applies_to: string[] | null
  ran: boolean   // true if the rule was actually executed for this phase_record
}

/** Result of running inference for a phase_record. */
export type InferenceRunResult = {
  subtype: string
  rules: InferenceRuleEntry[]       // all rules evaluated (or skipped) for this record
  inferred: string[]                // principals with score >= threshold
}

/** A contract entry — one subtype's required principals. */
export type ContractEntry = {
  subtype: string
  required_principals: string[]
}

/** Principal lifecycle stage — controls whether fake-check is permitted. */
export type PrincipalLifecycleStage =
  | "ontology_registered"
  | "declarable"
  | "required_enforced"
  | "inferable"
  | "fake_checkable"

export type PrincipalRegistryEntry = {
  principal: string
  stage: PrincipalLifecycleStage
  fake_check_eligible: boolean   // must be false unless stage = "fake_checkable"
}

// ---------------------------------------------------------------------------
// CC1: Canonical Ontology
// ---------------------------------------------------------------------------

/**
 * Check that a phase_record's subtype is not "unknown".
 * subtype=unknown means the phase name was not found in the canonical map —
 * a normalization or mapping failure that must be caught before gating.
 *
 * CC1 violation: subtype=unknown means phase string was not canonical.
 * CC4 violation: subtype=unknown must not reach the gate.
 */
export function checkSubtypeResolved(record: PhaseRecordInput): InvariantCheckResult {
  if (record.subtype !== "unknown" && record.subtype !== "") return pass()

  return fail({
    code: InvariantCodes.CC_SUBTYPE_UNKNOWN,
    severity: "error",
    message:
      `phase_record for phase="${record.phase}" has subtype="${record.subtype}". ` +
      `This means the phase name was not found in the canonical phase→subtype map. ` +
      `Either the phase string was not normalized (e.g. "EXECUTION" instead of "EXECUTE") ` +
      `or the phase has no contract. This record must not reach the principal gate.`,
  })
}

// ---------------------------------------------------------------------------
// CC2: Evaluated-Only Inference
// ---------------------------------------------------------------------------

/**
 * Check that fake principal detection only covers principals whose inference
 * rules actually ran for this phase_record.
 *
 * A principal is only "inferrable" if its rule ran (applies_to matched subtype).
 * A principal whose rule was skipped (applies_to mismatch) cannot be judged fake.
 */
export function checkEvaluatedOnlyInference(
  record: PhaseRecordInput,
  inferenceResult: InferenceRunResult,
): InvariantCheckResult {
  const failures: InvariantFailure[] = []

  const ranPrincipals = new Set(
    inferenceResult.rules.filter((r) => r.ran).map((r) => r.principal.toLowerCase())
  )
  const inferred = new Set(inferenceResult.inferred.map((p) => p.toLowerCase()))
  const declared = new Set(record.principals.map((p) => p.toLowerCase()))

  // fake = declared ∩ ran_and_evaluatable − inferred
  // NOT: declared ∩ all_registry − inferred
  const fakeCandidates = [...declared].filter((p) => ranPrincipals.has(p) && !inferred.has(p))

  // Detect if any principal is flagged fake when its rule didn't run
  const skippedPrincipals = new Set(
    inferenceResult.rules.filter((r) => !r.ran).map((r) => r.principal.toLowerCase())
  )
  const wronglyFlagged = [...declared].filter(
    (p) => skippedPrincipals.has(p) && !inferred.has(p)
  )

  if (wronglyFlagged.length > 0) {
    failures.push({
      code: InvariantCodes.CC_FAKE_CHECK_ON_UNEVALUATED,
      severity: "error",
      message:
        `principals [${wronglyFlagged.join(", ")}] were declared but their inference rules ` +
        `did not run (applies_to mismatch for subtype="${inferenceResult.subtype}"). ` +
        `These principals cannot be judged fake — absence of inference ≠ fake behavior. ` +
        `Only principals in {${[...ranPrincipals].join(", ")}} are subject to fake check.`,
    })
  }

  return failures.length === 0 ? pass() : fail(...failures)
}

// ---------------------------------------------------------------------------
// CC3: Contract Executability
// ---------------------------------------------------------------------------

/**
 * Check that every principal in a contract's required_principals either:
 *   (a) has a registered inference rule with matching applies_to for this subtype, OR
 *   (b) is explicitly marked fake_check_eligible=false in the principal registry
 *
 * An "orphan contract" — required principal with no inference rule and no lifecycle
 * protection — will silently misfire, creating RETRYABLE loops for correct behavior.
 */
export function checkContractExecutable(
  contract: ContractEntry,
  rules: InferenceRuleEntry[],
  principalRegistry: PrincipalRegistryEntry[],
): InvariantCheckResult {
  const failures: InvariantFailure[] = []

  for (const principal of contract.required_principals) {
    const pLower = principal.toLowerCase()

    // Does a rule exist that would run for this subtype?
    const hasMatchingRule = rules.some(
      (r) =>
        r.principal.toLowerCase() === pLower &&
        (r.applies_to === null || r.applies_to.includes(contract.subtype))
    )
    if (hasMatchingRule) continue

    // No matching rule — check lifecycle protection
    const entry = principalRegistry.find((e) => e.principal.toLowerCase() === pLower)
    if (entry && !entry.fake_check_eligible) continue  // protected by lifecycle stage

    failures.push({
      code: InvariantCodes.CC_ORPHAN_CONTRACT,
      severity: "error",
      message:
        `principal "${principal}" is required by contract "${contract.subtype}" but has no ` +
        `inference rule with applies_to matching "${contract.subtype}", and is not protected ` +
        `by lifecycle stage (fake_check_eligible=true or missing). ` +
        `Add an inference rule, or set fake_check_eligible=false in the principal registry.`,
    })
  }

  return failures.length === 0 ? pass() : fail(...failures)
}

/**
 * Check all contracts in a system.
 */
export function checkAllContractsExecutable(
  contracts: ContractEntry[],
  rules: InferenceRuleEntry[],
  principalRegistry: PrincipalRegistryEntry[],
): InvariantCheckResult {
  return mergeResults(contracts.map((c) => checkContractExecutable(c, rules, principalRegistry)))
}

// ---------------------------------------------------------------------------
// CC4: Subtype is First-Class (alias of CC1 gate check — explicit for clarity)
// ---------------------------------------------------------------------------

/**
 * Check that a phase_record with subtype=unknown is blocked before reaching
 * any gate or inference evaluation. This is the gate-entry guard.
 *
 * Identical logic to checkSubtypeResolved but named for the gate context.
 */
export function checkSubtypeNotUnknownAtGate(record: PhaseRecordInput): InvariantCheckResult {
  return checkSubtypeResolved(record)
}

// ---------------------------------------------------------------------------
// CC5: Inference Transparency
// ---------------------------------------------------------------------------

export type InferenceTransparencyEntry = {
  principal: string
  declared: boolean
  rule_ran: boolean
  inferred: boolean
  skip_reason?: string   // required when rule_ran=false and declared=true
}

/**
 * Check that every declared-but-not-inferred principal has a logged skip reason.
 * Without this, fake principal attribution cannot be distinguished from
 * "rule not applicable" — making debug impossible.
 */
export function checkInferenceTransparency(
  entries: InferenceTransparencyEntry[],
): InvariantCheckResult {
  const failures: InvariantFailure[] = []

  for (const e of entries) {
    if (!e.declared) continue            // not declared — not our concern
    if (e.inferred) continue             // inferred correctly — OK
    if (!e.rule_ran) {
      // Rule didn't run — skip_reason must be present
      if (!e.skip_reason || e.skip_reason.trim() === "") {
        failures.push({
          code: InvariantCodes.CC_INFERENCE_OPACITY,
          severity: "warning",
          message:
            `principal "${e.principal}" was declared but its inference rule did not run, ` +
            `and no skip_reason was logged. ` +
            `Log the reason (e.g. "applies_to_mismatch(analysis.root_cause)") so that ` +
            `fake vs unevaluated can be distinguished in debug output.`,
        })
      }
    }
  }

  return failures.length === 0 ? pass() : fail(...failures)
}

// ---------------------------------------------------------------------------
// Combined check
// ---------------------------------------------------------------------------

export function checkAllCognitionConsistency(
  record: PhaseRecordInput,
  inferenceResult: InferenceRunResult,
  transparencyEntries: InferenceTransparencyEntry[],
): InvariantCheckResult {
  return mergeResults([
    checkSubtypeResolved(record),
    checkEvaluatedOnlyInference(record, inferenceResult),
    checkInferenceTransparency(transparencyEntries),
  ])
}
