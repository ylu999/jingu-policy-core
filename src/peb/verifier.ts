/**
 * verifyPEB — verify that every PrincipleClaim has sufficient evidence.
 *
 * Hard rejection rules (gate FAILS, proposal does not proceed):
 *
 *   NO_EVIDENCE       — claim has zero evidence refs
 *   DECLARATIVE_ONLY  — all evidence refs are declarative type
 *   EMPTY_REF         — an evidence ref has empty `ref` field
 *   EMPTY_SUPPORTS    — an evidence ref has empty `supports` field
 *
 * An empty bundle (no claims) always passes — absence of claims is not a
 * violation. The enricher may have added no system claims for this proposal.
 *
 * Phase 1: structure verification only.
 * Phase 2 (p163): executable evidence refs will be run as CI checks.
 */

import type { PEBBundle, PEBFailure } from "./types.js"

export function verifyPEB(bundle: PEBBundle): PEBBundle {
  if (bundle.claims.length === 0) {
    return { claims: [], verified: true, failures: [] }
  }

  const failures: PEBFailure[] = []

  for (const claim of bundle.claims) {
    const pid = claim.principle_id

    // Rule 1: must have at least one evidence ref
    if (claim.evidence.length === 0) {
      failures.push({
        principle_id: pid,
        code: "NO_EVIDENCE",
        reason: `Claim "${pid}" has no evidence refs — at least one non-declarative ref required`,
      })
      continue  // no point checking further for this claim
    }

    // Rule 2: must not be all-declarative
    const nonDeclarative = claim.evidence.filter(e => e.type !== "declarative")
    if (nonDeclarative.length === 0) {
      failures.push({
        principle_id: pid,
        code: "DECLARATIVE_ONLY",
        reason: `Claim "${pid}" has only declarative evidence — at least one executable or observable ref required`,
      })
    }

    // Rule 3 + 4: each ref must have non-empty ref and supports
    for (const ref of claim.evidence) {
      if (!ref.ref || ref.ref.trim() === "") {
        failures.push({
          principle_id: pid,
          code: "EMPTY_REF",
          reason: `Claim "${pid}" has an evidence ref with empty "ref" field`,
          evidence_ref: ref.ref,
        })
      }
      if (!ref.supports || ref.supports.trim() === "") {
        failures.push({
          principle_id: pid,
          code: "EMPTY_SUPPORTS",
          reason: `Claim "${pid}" has an evidence ref with empty "supports" field`,
          evidence_ref: ref.ref,
        })
      }
    }
  }

  return {
    claims: bundle.claims,
    verified: failures.length === 0,
    failures,
  }
}
