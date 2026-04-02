/**
 * Machine-checkable counterpart to .claude/rules/runtime-truth.md.
 *
 * Runtime Truth First (RT1–RT8):
 *   RT1 — Verify execution identity before analyzing behavior
 *   RT2 — Absence of signal must be typed
 *   RT3 — Never attribute to model what could be wiring
 *   RT4 — Every critical feature must emit activation proof
 *   RT5 — No large-scale experiment without smoke test
 *   RT6 — Run artifacts must carry their own provenance
 *   RT7 — Commit ≠ deployed
 *   RT8 — Local code is not the system
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

export type RunArtifact = {
  image_digest?: string
  git_commit?: string
  build_timestamp?: string
  instance_id: string
}

export type AbsenceReport = {
  field: string
  attributed_to: "deployment_failure" | "wiring_failure" | "model_behavior" | "parser_failure" | "unclassified"
  identity_verified: boolean
}

export type ActivationProof = {
  feature_name: string
  feature_enabled: boolean
  version?: string
}

export type ExperimentRecord = {
  instance_count: number
  smoke_test_passed: boolean
  image_digest_verified: boolean
}

// ---------------------------------------------------------------------------
// RT1 — Verify Execution Identity Before Analyzing Behavior
// ---------------------------------------------------------------------------

export function checkExecutionIdentityVerified(
  artifact: RunArtifact
): InvariantCheckResult {
  const failures: InvariantFailure[] = []

  if (!artifact.image_digest) {
    failures.push({
      code: InvariantCodes.RT_IDENTITY_NOT_VERIFIED,
      message: `Run artifact for ${artifact.instance_id} is missing image_digest — execution identity unverified`,
      severity: "error",
    })
  }
  if (!artifact.git_commit) {
    failures.push({
      code: InvariantCodes.RT_IDENTITY_NOT_VERIFIED,
      message: `Run artifact for ${artifact.instance_id} is missing git_commit — cannot confirm which code version ran`,
      severity: "error",
    })
  }

  return failures.length === 0 ? pass() : fail(...failures)
}

// ---------------------------------------------------------------------------
// RT2 — Absence of Signal Must Be Typed
// ---------------------------------------------------------------------------

export function checkAbsenceIsTyped(
  report: AbsenceReport
): InvariantCheckResult {
  if (report.attributed_to === "unclassified") {
    return fail({
      code: InvariantCodes.RT_UNTYPED_ABSENCE,
      message: `Absence of '${report.field}' is unclassified — must be typed as deployment_failure | wiring_failure | model_behavior | parser_failure`,
      severity: "error",
    })
  }

  // RT3: if attributed to model_behavior, identity must have been verified first
  if (report.attributed_to === "model_behavior" && !report.identity_verified) {
    return fail({
      code: InvariantCodes.RT_MODEL_BLAMED_BEFORE_WIRING_CLEARED,
      message: `Absence of '${report.field}' attributed to model_behavior but execution identity was not verified — deployment_failure not ruled out`,
      severity: "error",
    })
  }

  return pass()
}

// ---------------------------------------------------------------------------
// RT4 — Every Critical Feature Must Emit Activation Proof
// ---------------------------------------------------------------------------

export function checkActivationProof(
  proofs: ActivationProof[],
  requiredFeatures: string[]
): InvariantCheckResult {
  const failures: InvariantFailure[] = []
  const proofMap = new Map(proofs.map(p => [p.feature_name, p]))

  for (const feature of requiredFeatures) {
    const proof = proofMap.get(feature)
    if (!proof) {
      failures.push({
        code: InvariantCodes.RT_MISSING_ACTIVATION_PROOF,
        message: `Required feature '${feature}' has no activation proof in run logs`,
        severity: "error",
      })
    } else if (!proof.feature_enabled) {
      failures.push({
        code: InvariantCodes.RT_MISSING_ACTIVATION_PROOF,
        message: `Feature '${feature}' reported feature_enabled=false — not live`,
        severity: "warning",
      })
    }
  }

  return failures.length === 0 ? pass() : fail(...failures)
}

// ---------------------------------------------------------------------------
// RT5 — No Large-Scale Experiment Without Smoke Test
// ---------------------------------------------------------------------------

export function checkSmokeTestRequired(
  experiment: ExperimentRecord
): InvariantCheckResult {
  if (experiment.instance_count > 1 && !experiment.smoke_test_passed) {
    return fail({
      code: InvariantCodes.RT_BATCH_WITHOUT_SMOKE_TEST,
      message: `Batch of ${experiment.instance_count} instances launched without a passing smoke test — behavior of new version unconfirmed`,
      severity: "error",
    })
  }
  return pass()
}

// ---------------------------------------------------------------------------
// RT6 — Run Artifacts Must Carry Their Own Provenance
// ---------------------------------------------------------------------------

export function checkArtifactProvenance(
  artifact: RunArtifact
): InvariantCheckResult {
  const missing: string[] = []
  if (!artifact.image_digest) missing.push("image_digest")
  if (!artifact.git_commit) missing.push("git_commit")
  if (!artifact.build_timestamp) missing.push("build_timestamp")

  if (missing.length > 0) {
    return fail({
      code: InvariantCodes.RT_ARTIFACT_MISSING_PROVENANCE,
      message: `Run artifact for ${artifact.instance_id} is missing provenance fields: ${missing.join(", ")}`,
      severity: "warning",
    })
  }
  return pass()
}

// ---------------------------------------------------------------------------
// Composite: check all RT principles for a run artifact
// ---------------------------------------------------------------------------

export function checkAllRuntimeTruthPrinciples(
  artifact: RunArtifact,
  experiment?: ExperimentRecord
): InvariantCheckResult {
  const results: InvariantCheckResult[] = [
    checkExecutionIdentityVerified(artifact),
    checkArtifactProvenance(artifact),
  ]
  if (experiment) {
    results.push(checkSmokeTestRequired(experiment))
  }
  return mergeResults(results)
}
