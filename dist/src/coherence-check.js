"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkReasoningCoherence = checkReasoningCoherence;
/**
 * checkReasoningCoherence
 *
 * Validates that the reasoning chain is internally consistent.
 * Not just "fields exist" — but "the fields connect logically."
 *
 * Chain: coreTension → layer → symptoms → hypotheses → intervention → nextStep
 */
function checkReasoningCoherence(frame) {
    const issues = [];
    // Check 1: coreTension must describe a CONFLICT, not just restate the goal
    // Heuristic: good tension contains contrast words OR two competing concerns
    const tensionHasConflict = containsConflictPattern(frame.coreTension);
    if (!tensionHasConflict) {
        issues.push({
            chain: "coreTension",
            issue: "Core tension reads as a goal restatement, not a conflict. Good tension names two competing concerns (e.g. 'fix X without breaking Y', 'speed vs correctness').",
            severity: "warning",
        });
    }
    // Check 2: symptoms must be observable phenomena, not conclusions
    // Heuristic: symptoms should NOT start with "because", "due to", "caused by"
    for (const symptom of frame.symptoms) {
        if (isCausalStatement(symptom)) {
            issues.push({
                chain: "symptoms",
                issue: `Symptom "${symptom.slice(0, 60)}..." reads as a cause/conclusion, not an observation. Symptoms should be observable facts (what you see), not explanations (why it happens).`,
                severity: "warning",
            });
        }
    }
    // Check 3: hypotheses must be mechanistic — they must explain symptoms
    // Heuristic: at least one hypothesis should reference or relate to at least one symptom keyword
    if (frame.symptoms.length > 0 && frame.hypotheses.length > 0) {
        const symptomKeywords = extractKeywords(frame.symptoms.join(" "));
        const hypothesisText = frame.hypotheses.join(" ").toLowerCase();
        const overlap = symptomKeywords.some(kw => hypothesisText.includes(kw));
        if (!overlap) {
            issues.push({
                chain: "symptoms → hypotheses",
                issue: "Hypotheses do not appear to explain the stated symptoms. Hypotheses should propose mechanisms that would cause the observed symptoms.",
                severity: "reject",
            });
        }
    }
    // Check 4: intervention must align with rootCauseCandidate or hypotheses
    // Heuristic: intervention should reference keywords from rootCause or hypotheses
    if (frame.proposedIntervention) {
        const causeText = [
            frame.rootCauseCandidate || "",
            ...frame.hypotheses,
        ].join(" ").toLowerCase();
        const interventionText = frame.proposedIntervention.toLowerCase();
        const causeKeywords = extractKeywords(causeText);
        const interventionAligned = causeKeywords.some(kw => interventionText.includes(kw));
        if (causeKeywords.length > 0 && !interventionAligned) {
            issues.push({
                chain: "hypotheses/rootCause → intervention",
                issue: "Proposed intervention does not appear to address the stated root cause or hypotheses. The fix should target the identified cause, not the symptom.",
                severity: "reject",
            });
        }
    }
    // Check 5: tradeoffs must contain actual trade (two sides)
    // Heuristic: good tradeoff has "vs" or two clauses separated by contrast conjunction
    for (const tradeoff of frame.tradeoffs) {
        if (!containsTradeoffPattern(tradeoff)) {
            issues.push({
                chain: "tradeoffs",
                issue: `Tradeoff "${tradeoff.slice(0, 60)}..." does not describe a trade. State what you gain and what you sacrifice (e.g. 'minimal fix vs full refactor — prefer minimal to reduce blast radius').`,
                severity: "warning",
            });
        }
    }
    // Check 6: nextStep must be concrete and consistent with intervention
    // Heuristic: nextStep should be a verb phrase (action), not a goal
    if (frame.nextStep && !isActionPhrase(frame.nextStep)) {
        issues.push({
            chain: "nextStep",
            issue: "Next step reads as a goal rather than a concrete action. Use a verb phrase: 'Read X', 'Run Y', 'Update Z'.",
            severity: "warning",
        });
    }
    // Check 7: layer must be consistent with symptom types
    // Heuristic: if symptoms mention "test fail" or "code", layer should not be "requirements" or "architecture"
    if (frame.problemLayer && frame.symptoms.length > 0) {
        const symptomText = frame.symptoms.join(" ").toLowerCase();
        const layerMismatch = detectLayerMismatch(frame.problemLayer, symptomText);
        if (layerMismatch) {
            issues.push({
                chain: "symptoms → problemLayer",
                issue: layerMismatch,
                severity: "warning",
            });
        }
    }
    if (issues.length === 0)
        return { coherent: true };
    return { coherent: false, issues };
}
// --- Helpers ---
function containsConflictPattern(text) {
    const lower = text.toLowerCase();
    const conflictMarkers = [
        " vs ", " without ", " while ", " but ", " despite ",
        "tradeoff", "tension", "constraint", "balance", "preserve",
        "cannot both", "at the cost of", "risk of",
    ];
    return conflictMarkers.some(m => lower.includes(m));
}
function isCausalStatement(text) {
    const lower = text.toLowerCase().trim();
    return (lower.startsWith("because") ||
        lower.startsWith("due to") ||
        lower.startsWith("caused by") ||
        lower.startsWith("since ") ||
        lower.startsWith("the root cause"));
}
function containsTradeoffPattern(text) {
    const lower = text.toLowerCase();
    return (lower.includes(" vs ") ||
        lower.includes(" versus ") ||
        lower.includes(" over ") ||
        lower.includes(" rather than ") ||
        lower.includes(" instead of ") ||
        lower.includes(" at the cost of ") ||
        (lower.includes(" but ") && lower.length > 20));
}
function isActionPhrase(text) {
    const lower = text.toLowerCase().trim();
    const actionVerbs = [
        "read ", "run ", "check ", "update ", "fix ", "add ", "remove ",
        "inspect ", "verify ", "write ", "create ", "delete ", "test ",
        "apply ", "install ", "configure ", "deploy ", "revert ", "rollback ",
    ];
    return actionVerbs.some(v => lower.startsWith(v));
}
function extractKeywords(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s\-_]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 3)
        .filter(w => !STOP_WORDS.has(w));
}
function detectLayerMismatch(layer, symptomText) {
    if (layer === "requirements" && (symptomText.includes("test fail") || symptomText.includes("null pointer") || symptomText.includes("500 error"))) {
        return "Problem layer is 'requirements' but symptoms suggest an execution/code issue. Consider 'execution' or 'state' as layer.";
    }
    if (layer === "execution" && (symptomText.includes("design") || symptomText.includes("architecture") || symptomText.includes("api contract"))) {
        return "Problem layer is 'execution' but symptoms suggest an architectural issue. Consider 'architecture' as layer.";
    }
    return null;
}
const STOP_WORDS = new Set([
    "that", "this", "with", "from", "have", "been", "will", "would",
    "could", "should", "when", "then", "than", "there", "their", "they",
    "what", "which", "where", "into", "also", "some", "more", "most",
]);
