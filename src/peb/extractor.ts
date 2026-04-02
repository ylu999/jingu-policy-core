/**
 * extractPEB — extract PrincipleClaims from an RPPRecord.
 *
 * RPPRecord does not have a principle_claims field by default.
 * The LLM may include a `principle_claims` array in the response content
 * as a JSON block. This extractor looks for it in two places:
 *
 *   1. rpp.response.content — the LLM may embed a JSON block there
 *   2. The raw llm_output string — fallback scan
 *
 * If no principle_claims are found, returns an empty bundle (not a failure —
 * the enricher in jingu-agent will add system-known claims separately).
 *
 * Extraction is structural: looks for a JSON array of { principle_id, claim, evidence[] }.
 * Does not infer claims from free text.
 */

import type { RPPRecord } from "jingu-protocol"
import type { PEBBundle, PrincipleClaim, PEBEvidenceRef } from "./types.js"

/** Attempt to parse principle_claims from a JSON string fragment. */
function tryParseClaimsFromText(text: string): PrincipleClaim[] | null {
  // Find the start of the principle_claims array using index-based scan.
  // Regex with non-greedy *? stops at first ']' inside nested arrays — use
  // manual bracket-counting to find the matching outer ']' instead.
  const keyIdx = text.indexOf('"principle_claims"')
  if (keyIdx === -1) return null
  const arrStart = text.indexOf("[", keyIdx + 18)
  if (arrStart === -1) return null

  // Walk forward counting '[' and ']' to find the matching close bracket.
  let depth = 0
  let arrEnd = -1
  for (let i = arrStart; i < text.length; i++) {
    if (text[i] === "[") depth++
    else if (text[i] === "]") {
      depth--
      if (depth === 0) { arrEnd = i; break }
    }
  }
  if (arrEnd === -1) return null

  try {
    const raw = JSON.parse(text.slice(arrStart, arrEnd + 1)) as unknown[]
    if (!Array.isArray(raw)) return null
    const claims: PrincipleClaim[] = []
    for (const item of raw) {
      if (typeof item !== "object" || item === null) continue
      const obj = item as Record<string, unknown>
      if (typeof obj["principle_id"] !== "string") continue
      if (typeof obj["claim"] !== "string") continue
      const evidence = parseEvidence(obj["evidence"])
      claims.push({
        principle_id: obj["principle_id"],
        claim: obj["claim"],
        evidence,
      })
    }
    return claims.length > 0 ? claims : null
  } catch {
    return null
  }
}

function parseEvidence(raw: unknown): PEBEvidenceRef[] {
  if (!Array.isArray(raw)) return []
  const refs: PEBEvidenceRef[] = []
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue
    const obj = item as Record<string, unknown>
    const type = obj["type"]
    if (type !== "executable" && type !== "observable" && type !== "declarative") continue
    if (typeof obj["ref"] !== "string") continue
    if (typeof obj["supports"] !== "string") continue
    refs.push({ type, ref: obj["ref"], supports: obj["supports"] })
  }
  return refs
}

/**
 * Extract PEB claims from an RPPRecord.
 * Returns empty bundle if no principle_claims found — not a failure.
 */
export function extractPEB(rpp: RPPRecord): PEBBundle {
  // Search in response content first
  const responseText = rpp.response.content.join("\n")
  let claims = tryParseClaimsFromText(responseText)

  // Search in step content if not found in response
  if (!claims) {
    for (const step of rpp.steps) {
      const stepText = step.content.join("\n")
      claims = tryParseClaimsFromText(stepText)
      if (claims) break
    }
  }

  if (!claims || claims.length === 0) {
    return { claims: [], verified: true, failures: [] }
  }

  return { claims, verified: true, failures: [] }
}

/**
 * Extract PEB claims from raw LLM output string (fallback when RPP parse failed).
 */
export function extractPEBFromRaw(raw: string): PEBBundle {
  const claims = tryParseClaimsFromText(raw)
  if (!claims || claims.length === 0) {
    return { claims: [], verified: true, failures: [] }
  }
  return { claims, verified: true, failures: [] }
}
