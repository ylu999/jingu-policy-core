/**
 * PEB — Principle-Evidence Binding types
 *
 * A PrincipleClaim asserts that a named principle is satisfied.
 * Every claim must be backed by at least one non-declarative EvidenceRef.
 * The system rejects claims that cannot prove themselves.
 *
 * Evidence types (in trust order):
 *   executable  — CI script / runnable check — highest trust
 *   observable  — trace / log / test output  — medium trust
 *   declarative — docs / comments / assertion — lowest trust, cannot stand alone
 */

export type PEBEvidenceType = "executable" | "observable" | "declarative"

export type PEBEvidenceRef = {
  type: PEBEvidenceType
  ref: string       // CI command / file path / log locator — must be non-empty
  supports: string  // which aspect of the claim this evidence covers — must be non-empty
}

export type PrincipleClaim = {
  principle_id: string   // e.g. "P4a", "EM7", "R1"
  claim: string          // human-readable assertion
  evidence: PEBEvidenceRef[]
}

export type PEBFailureCode =
  | "NO_EVIDENCE"         // claim has zero evidence refs
  | "DECLARATIVE_ONLY"    // all evidence refs are declarative type
  | "EMPTY_REF"           // an evidence ref has empty `ref` field
  | "EMPTY_SUPPORTS"      // an evidence ref has empty `supports` field

export type PEBFailure = {
  principle_id: string
  code: PEBFailureCode
  reason: string
  evidence_ref?: string   // which ref triggered this failure (when applicable)
}

export type PEBBundle = {
  claims: PrincipleClaim[]
  verified: boolean
  failures: PEBFailure[]
}
