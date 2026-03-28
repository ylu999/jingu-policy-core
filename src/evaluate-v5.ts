import { evaluateV4 } from "./evaluate-v4.js"
import type { V4StageResult } from "./evaluate-v4.js"
import type { Input } from "./types.js"
import type { CoherenceJudge, CoherenceJudgeResult } from "./coherence-check.js"

// ─── CoherenceJudgement (detailed semantic verdict) ─────────────────────────

/**
 * Classifies what kind of reasoning gap was found.
 *
 * missing_mechanism   — hypothesis doesn't name a causal component at all
 * weak_causality      — hypothesis names something but the causal link to symptoms is implausible
 * intervention_mismatch — intervention targets a different component than the hypothesis names
 * generic_reasoning   — all parts present but too vague/circular to be falsifiable
 */
export type ReasoningGapType =
  | "missing_mechanism"
  | "weak_causality"
  | "intervention_mismatch"
  | "generic_reasoning"

export type CoherenceJudgement = {
  explains: boolean         // hypothesis plausibly explains the symptoms?
  targets: boolean          // intervention operates on the hypothesis mechanism?
  consistency: boolean      // reasoning chain internally consistent?
  confidence: number        // 0–1
  issues: string[]          // specific problems found
  reasoningGapType?: ReasoningGapType  // primary failure category (undefined when coherent)
}

// ─── V5 result types ─────────────────────────────────────────────────────────

/**
 * Reject strength:
 *   hard  — confidence >= 0.8 AND at least one link broken → do not execute
 *   soft  — confidence in [0.6, 0.8) AND link broken → overridePossible=true
 *           (caller can log + proceed with elevated risk, or escalate)
 */
export type SemanticRejectStrength = "hard" | "soft"

export type V5SemanticResult = {
  stage: "semantic"
  decision: "accept" | "reject"
  rejectStrength?: SemanticRejectStrength   // present only when decision === "reject"
  overridePossible?: boolean                // true when soft reject
  judgement: CoherenceJudgement
  summary: string
}

export type V5StageResult =
  | V4StageResult                                    // reasoning or regime stage
  | V5SemanticResult                                 // semantic judge stage

// ─── evaluateV5 ───────────────────────────────────────────────────────────────
//
// Layer 1: evaluateV4 (deterministic local rules — reasoning gate + regime)
// Layer 2: optional LLM semantic judge (only called when v4 accepts or warns-only)
// Layer 3: merge — LLM judge verdict overrides accept when it finds incoherence
//
// Callers that don't provide a judge get identical behavior to evaluateV4.

export async function evaluateV5(
  input: Input,
  judge?: CoherenceJudge,
): Promise<V5StageResult> {
  // Layer 1 — deterministic
  const v4 = evaluateV4(input)

  // Hard stops: reasoning reject or block — no point calling LLM
  if (v4.stage === "reasoning") return v4
  if (v4.stage === "regime" && v4.decision === "block") return v4

  // If no judge provided, return v4 as-is
  if (!judge) return v4

  // Only call judge when v4 accepts or produces warnings only (not hard reject)
  // Rationale: if v4 already rejects, LLM can't improve the verdict
  if (v4.stage === "regime" && v4.decision === "reject") return v4

  // Layer 2 — semantic judge
  const reasoningFrame = input.reasoningFrame
  if (!reasoningFrame || reasoningFrame.hypotheses.length === 0) {
    // Nothing to semantically evaluate — no reasoning frame
    return v4
  }

  let judgeResult: CoherenceJudgeResult
  try {
    judgeResult = await judge.evaluate({
      symptoms: reasoningFrame.symptoms,
      hypotheses: reasoningFrame.hypotheses,
      proposedIntervention: reasoningFrame.proposedIntervention ?? "",
      rootCauseCandidate: reasoningFrame.rootCauseCandidate,
    })
  } catch {
    // Judge failure is non-fatal — fall back to v4 result
    return v4
  }

  // Layer 3 — merge
  // The judge returns CoherenceJudgeResult (verdict + reason)
  // We need to reconstruct a CoherenceJudgement from it for the result
  if (judgeResult.verdict === "coherent") {
    return v4  // semantic confirms local — return v4
  }

  // Judge found incoherence — override
  const pseudoJudgement: CoherenceJudgement = {
    explains: false,
    targets: false,
    consistency: false,
    confidence: 1.0,
    issues: [judgeResult.reason],
  }

  return {
    stage: "semantic",
    decision: "reject",
    judgement: pseudoJudgement,
    summary: `REJECTED (semantic) — ${judgeResult.reason}`,
  }
}

// ─── evaluateV5WithJudgement ──────────────────────────────────────────────────
//
// Variant that accepts a judge returning the full CoherenceJudgement object
// (richer than CoherenceJudgeResult). Used by LLMCoherenceJudge which produces
// the full structured output directly.

export interface RichCoherenceJudge {
  evaluateRich(input: { symptoms: string[]; hypotheses: string[]; proposedIntervention: string; rootCauseCandidate?: string }): Promise<CoherenceJudgement>
}

export async function evaluateV5WithJudgement(
  input: Input,
  judge?: RichCoherenceJudge,
): Promise<V5StageResult> {
  // Layer 1
  const v4 = evaluateV4(input)

  if (v4.stage === "reasoning") return v4
  if (v4.stage === "regime" && v4.decision === "block") return v4
  if (!judge) return v4
  if (v4.stage === "regime" && v4.decision === "reject") return v4

  const reasoningFrame = input.reasoningFrame
  if (!reasoningFrame || reasoningFrame.hypotheses.length === 0) return v4

  let judgement: CoherenceJudgement
  try {
    judgement = await judge.evaluateRich({
      symptoms: reasoningFrame.symptoms,
      hypotheses: reasoningFrame.hypotheses,
      proposedIntervention: reasoningFrame.proposedIntervention ?? "",
      rootCauseCandidate: reasoningFrame.rootCauseCandidate,
    })
  } catch {
    return v4
  }

  // ── Layer 3: dual-threshold merge ──────────────────────────────────────────
  //
  // confidence < 0.6              → reject (low confidence, don't trust either way)
  // confidence in [0.6, 0.8)
  //   + link broken               → SOFT reject (overridePossible=true)
  //   + all links pass            → accept (judge unsure but leans coherent)
  // confidence >= 0.8
  //   + link broken               → HARD reject (LLM is confident about failure)
  //   + all links pass            → accept
  //
  // Rationale: LLM judge is a strong signal, not an absolute authority.
  // Soft reject preserves caller autonomy for borderline cases.

  const linkBroken = !judgement.explains || !judgement.targets || !judgement.consistency
  const { confidence } = judgement

  if (!linkBroken && confidence >= 0.6) return v4  // accept

  const issueText = judgement.issues.length > 0
    ? judgement.issues.join("; ")
    : "Reasoning chain lacks semantic coherence"

  const gapTag = judgement.reasoningGapType ? ` [${judgement.reasoningGapType}]` : ""

  if (confidence < 0.6) {
    return {
      stage: "semantic",
      decision: "reject",
      rejectStrength: "hard",
      overridePossible: false,
      judgement,
      summary: `REJECTED (semantic/low-confidence=${confidence.toFixed(2)})${gapTag} — ${issueText}`,
    }
  }

  if (confidence < 0.8) {
    // soft reject — caller can override
    return {
      stage: "semantic",
      decision: "reject",
      rejectStrength: "soft",
      overridePossible: true,
      judgement,
      summary: `SOFT-REJECTED (semantic, confidence=${confidence.toFixed(2)})${gapTag} — ${issueText}`,
    }
  }

  // confidence >= 0.8 + link broken → hard reject
  return {
    stage: "semantic",
    decision: "reject",
    rejectStrength: "hard",
    overridePossible: false,
    judgement,
    summary: `REJECTED (semantic, confidence=${confidence.toFixed(2)})${gapTag} — ${issueText}`,
  }
}
