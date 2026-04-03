/**
 * taxonomy.ts — CDP v1 Principal Taxonomy (p174)
 *
 * 17 principals across 3 categories:
 *   - Debugging (6)
 *   - Reasoning (5)
 *   - Design (6)
 *
 * Each principal declares: id, category, description, whenToUse, requiredEvidence, violation.
 */

// ── PrincipalId ───────────────────────────────────────────────────────────────

export type PrincipalCategory = "debugging" | "reasoning" | "design"

export type PrincipalId =
  // Debugging
  | "P_DEBUG_ROOT_CAUSE_ISOLATION"
  | "P_DEBUG_LAYER_ORDER"
  | "P_DEBUG_VERIFY_BEFORE_ATTRIBUTION"
  | "P_DEBUG_DETERMINISTIC_FIRST"
  | "P_DEBUG_OBSERVABILITY_GROUNDED"
  | "P_DEBUG_MINIMAL_CAUSE"
  // Reasoning
  | "P_REASON_EVIDENCE_GROUNDED"
  | "P_REASON_NO_UNSUPPORTED_INFERENCE"
  | "P_REASON_COMPLETE_COVERAGE"
  | "P_REASON_CONSISTENCY"
  | "P_REASON_EXPLICIT_UNCERTAINTY"
  // Design
  | "P_DESIGN_VERIFY_BEFORE_COMMIT"
  | "P_DESIGN_CONSTRAINT_AWARE"
  | "P_DESIGN_MINIMAL_CHANGE"
  | "P_DESIGN_RISK_AWARE"
  | "P_DESIGN_TRACEABLE"
  | "P_DESIGN_ORTHOGONAL"

// ── Principal definition ──────────────────────────────────────────────────────

export interface Principal {
  id:               PrincipalId
  category:         PrincipalCategory
  description:      string
  whenToUse:        string
  requiredEvidence: string
  violation:        string
}

// ── PRINCIPALS table (17 entries) ─────────────────────────────────────────────

export const PRINCIPALS: Record<PrincipalId, Principal> = {

  // ── Debugging (6) ──────────────────────────────────────────────────────────

  P_DEBUG_ROOT_CAUSE_ISOLATION: {
    id:               "P_DEBUG_ROOT_CAUSE_ISOLATION",
    category:         "debugging",
    description:      "Isolate the minimal root cause before attributing blame",
    whenToUse:        "Any diagnostic or debugging cognition step",
    requiredEvidence: "Multiple hypotheses considered OR elimination evidence for discarded paths",
    violation:        "Attribution made without considering alternative causes",
  },
  P_DEBUG_LAYER_ORDER: {
    id:               "P_DEBUG_LAYER_ORDER",
    category:         "debugging",
    description:      "Check layers in order: infra → wiring → data → model",
    whenToUse:        "Multi-layer system debugging",
    requiredEvidence: "At least 2 distinct system layers referenced with pass/fail status each",
    violation:        "Jumped directly to a higher-level layer without verifying lower layers",
  },
  P_DEBUG_VERIFY_BEFORE_ATTRIBUTION: {
    id:               "P_DEBUG_VERIFY_BEFORE_ATTRIBUTION",
    category:         "debugging",
    description:      "No attribution without direct supporting evidence",
    whenToUse:        "Any step that attributes failure to a specific component or cause",
    requiredEvidence: "Attribution accompanied by at least one direct evidence item",
    violation:        "Attribution made with no supporting evidence (speculation presented as fact)",
  },
  P_DEBUG_DETERMINISTIC_FIRST: {
    id:               "P_DEBUG_DETERMINISTIC_FIRST",
    category:         "debugging",
    description:      "Verify deterministic components before blaming probabilistic ones",
    whenToUse:        "Debugging systems that mix deterministic and probabilistic components",
    requiredEvidence: "Deterministic layer explicitly checked before model/probabilistic layer blamed",
    violation:        "Model or probabilistic component blamed without first verifying deterministic layers",
  },
  P_DEBUG_OBSERVABILITY_GROUNDED: {
    id:               "P_DEBUG_OBSERVABILITY_GROUNDED",
    category:         "debugging",
    description:      "All claims must be grounded in observable system state",
    whenToUse:        "All debugging steps",
    requiredEvidence: "Logs, outputs, rendered results, or observable artifacts cited for each claim",
    violation:        "Claims made about system behavior without citing observable evidence",
  },
  P_DEBUG_MINIMAL_CAUSE: {
    id:               "P_DEBUG_MINIMAL_CAUSE",
    category:         "debugging",
    description:      "Prefer the simplest sufficient explanation that covers all observed symptoms",
    whenToUse:        "When multiple explanations are possible",
    requiredEvidence: "Proposed explanation accounts for all observed symptoms",
    violation:        "Complex explanation chosen when a simpler one would fully account for symptoms",
  },

  // ── Reasoning (5) ──────────────────────────────────────────────────────────

  P_REASON_EVIDENCE_GROUNDED: {
    id:               "P_REASON_EVIDENCE_GROUNDED",
    category:         "reasoning",
    description:      "Every claim must have at least one evidence reference",
    whenToUse:        "All reasoning and analysis steps",
    requiredEvidence: "Claim-to-evidence mapping present for every substantive assertion",
    violation:        "Claim made with no supporting evidence reference",
  },
  P_REASON_NO_UNSUPPORTED_INFERENCE: {
    id:               "P_REASON_NO_UNSUPPORTED_INFERENCE",
    category:         "reasoning",
    description:      "No extrapolation beyond what the evidence directly supports",
    whenToUse:        "Inference, synthesis, and analysis steps",
    requiredEvidence: "All inferred conclusions stay within the scope of cited references",
    violation:        "New facts introduced that cannot be derived from cited evidence",
  },
  P_REASON_COMPLETE_COVERAGE: {
    id:               "P_REASON_COMPLETE_COVERAGE",
    category:         "reasoning",
    description:      "Cover all required dimensions or aspects of the problem",
    whenToUse:        "Analysis and planning steps with known required dimensions",
    requiredEvidence: "Explicit coverage of each required dimension or checklist item",
    violation:        "Required dimension omitted without justification",
  },
  P_REASON_CONSISTENCY: {
    id:               "P_REASON_CONSISTENCY",
    category:         "reasoning",
    description:      "No internal contradiction across claims within the same cognition step",
    whenToUse:        "All multi-claim reasoning steps",
    requiredEvidence: "Claims are internally consistent — no pair of claims directly contradicts",
    violation:        "Two claims in the same step directly contradict each other",
  },
  P_REASON_EXPLICIT_UNCERTAINTY: {
    id:               "P_REASON_EXPLICIT_UNCERTAINTY",
    category:         "reasoning",
    description:      "Unknown or uncertain claims must be explicitly marked",
    whenToUse:        "Any step where some conclusions are uncertain",
    requiredEvidence: "Uncertainty markers present where applicable (e.g., 'likely', 'possibly', explicit qualification)",
    violation:        "Uncertain claim presented as definite fact without qualification",
  },

  // ── Design (6) ──────────────────────────────────────────────────────────────

  P_DESIGN_VERIFY_BEFORE_COMMIT: {
    id:               "P_DESIGN_VERIFY_BEFORE_COMMIT",
    category:         "design",
    description:      "Define verification criteria before committing to a design decision",
    whenToUse:        "Design and decision steps",
    requiredEvidence: "Verification/acceptance criteria stated before or alongside the design choice",
    violation:        "Design committed to without stating how it will be verified",
  },
  P_DESIGN_CONSTRAINT_AWARE: {
    id:               "P_DESIGN_CONSTRAINT_AWARE",
    category:         "design",
    description:      "Respect all declared system constraints",
    whenToUse:        "All design and execution steps",
    requiredEvidence: "Relevant system constraints listed and addressed",
    violation:        "Design violates or ignores a known system constraint",
  },
  P_DESIGN_MINIMAL_CHANGE: {
    id:               "P_DESIGN_MINIMAL_CHANGE",
    category:         "design",
    description:      "Make the smallest sufficient change to achieve the goal",
    whenToUse:        "Implementation and execution steps",
    requiredEvidence: "Scope justification present — why this change is necessary and no larger",
    violation:        "Change scope exceeds what is required to achieve the stated goal",
  },
  P_DESIGN_RISK_AWARE: {
    id:               "P_DESIGN_RISK_AWARE",
    category:         "design",
    description:      "Identify and address potential failure modes",
    whenToUse:        "Design and planning steps with non-trivial risk surface",
    requiredEvidence: "At least one failure mode or risk identified and addressed",
    violation:        "Design proceeds without considering any potential failure modes",
  },
  P_DESIGN_TRACEABLE: {
    id:               "P_DESIGN_TRACEABLE",
    category:         "design",
    description:      "Decisions must be traceable to prior reasoning steps",
    whenToUse:        "Decision and design steps",
    requiredEvidence: "Reasoning chain from prior analysis to current decision is present",
    violation:        "Decision made without traceable reasoning from earlier steps",
  },
  P_DESIGN_ORTHOGONAL: {
    id:               "P_DESIGN_ORTHOGONAL",
    category:         "design",
    description:      "New component must not duplicate existing functionality",
    whenToUse:        "Design steps introducing new components or abstractions",
    requiredEvidence: "Overlap analysis present — confirms new component does not duplicate existing",
    violation:        "New component introduced without checking for functional overlap with existing",
  },
}

// ── Accessors ─────────────────────────────────────────────────────────────────

export const ALL_PRINCIPAL_IDS: PrincipalId[] = Object.keys(PRINCIPALS) as PrincipalId[]

export function getPrincipal(id: PrincipalId): Principal {
  return PRINCIPALS[id]
}

export function getPrincipalsByCategory(category: PrincipalCategory): Principal[] {
  return ALL_PRINCIPAL_IDS
    .map(id => PRINCIPALS[id])
    .filter(p => p.category === category)
}

export function isValidPrincipalId(id: string): id is PrincipalId {
  return id in PRINCIPALS
}
