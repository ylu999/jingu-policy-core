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
 *
 * Design principle:
 * - Does NOT use keyword overlap (too easily gamed by injecting hypothesis words into symptoms)
 * - Checks for MECHANISM OBJECTS: hypothesis must name a plausible causal component
 * - Checks for INTERVENTION ALIGNMENT: fix must operate on the same mechanism the hypothesis names
 * - Checks for NON-RESTATEMENT: hypothesis must add explanatory content beyond symptoms
 */
function checkReasoningCoherence(frame) {
    const issues = [];
    // Check 1: coreTension must describe a CONFLICT, not just restate the goal
    const tensionHasConflict = containsConflictPattern(frame.coreTension);
    if (!tensionHasConflict) {
        issues.push({
            chain: "coreTension",
            issue: "Core tension reads as a goal restatement, not a conflict. Good tension names two competing concerns (e.g. 'fix X without breaking Y', 'speed vs correctness').",
            severity: "warning",
        });
    }
    // Check 2: symptoms must be observable phenomena, not conclusions
    for (const symptom of frame.symptoms) {
        if (isCausalStatement(symptom)) {
            issues.push({
                chain: "symptoms",
                issue: `Symptom "${symptom.slice(0, 60)}..." reads as a cause/conclusion, not an observation. Symptoms should be observable facts (what you see), not explanations (why it happens).`,
                severity: "warning",
            });
        }
    }
    // Check 3: hypothesis → mechanism → intervention alignment
    //
    // This replaces keyword-overlap with three structural checks:
    //
    //   3a. Non-restatement: hypothesis must not simply rewrite symptom text
    //   3b. Mechanism presence: hypothesis must name a mechanism object
    //       (a resource, component, boundary, config, state constraint, dependency)
    //   3c. Intervention alignment: the intervention must operate on the same mechanism
    //       the hypothesis names — not a different system component entirely
    //
    // Rationale: keyword overlap was too easily gamed (add hypothesis words to symptoms).
    // "mechanism object" presence + intervention alignment is harder to fake without
    // actually writing a coherent causal chain.
    if (frame.hypotheses.length > 0 && frame.proposedIntervention) {
        const mechanismCheck = checkMechanismChain(frame);
        if (mechanismCheck) {
            issues.push(mechanismCheck);
        }
    }
    // Check 4 (legacy — retained for cases where check 3 doesn't fire):
    // If hypothesis has mechanism objects AND intervention exists, but they point
    // to completely different domains, reject.
    // NOTE: this is now a backstop for check 3, not the primary check.
    if (frame.hypotheses.length > 0 && frame.proposedIntervention && !issues.find(i => i.chain === "hypothesis → intervention")) {
        const domainMismatch = checkDomainMismatch(frame);
        if (domainMismatch) {
            issues.push(domainMismatch);
        }
    }
    // Check 5: tradeoffs must contain actual trade (two sides)
    for (const tradeoff of frame.tradeoffs) {
        if (!containsTradeoffPattern(tradeoff)) {
            issues.push({
                chain: "tradeoffs",
                issue: `Tradeoff "${tradeoff.slice(0, 60)}..." does not describe a trade. State what you gain and what you sacrifice (e.g. 'minimal fix vs full refactor — prefer minimal to reduce blast radius').`,
                severity: "warning",
            });
        }
    }
    // Check 6: nextStep must be concrete and actionable
    if (frame.nextStep && !isActionPhrase(frame.nextStep)) {
        issues.push({
            chain: "nextStep",
            issue: "Next step reads as a goal rather than a concrete action. Use a verb phrase: 'Read X', 'Run Y', 'Update Z'.",
            severity: "warning",
        });
    }
    // Check 7: layer must be consistent with symptom types
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
// --- Check 3: mechanism chain validation ---
function checkMechanismChain(frame) {
    const hypothesisText = frame.hypotheses.join(" ").toLowerCase();
    const symptomText = frame.symptoms.join(" ").toLowerCase();
    const interventionText = frame.proposedIntervention.toLowerCase();
    // 3a. Non-restatement check
    // If hypothesis text is largely the same as symptom text (> 60% word overlap),
    // it's a restatement, not a mechanism.
    if (isRestatement(symptomText, hypothesisText)) {
        return {
            chain: "symptoms → hypothesis",
            issue: "Hypothesis appears to restate the symptom rather than proposing a causal mechanism. A hypothesis should explain WHY the symptom occurs (e.g. not 'errors occur' but 'connection pool exhausted under load').",
            severity: "reject",
        };
    }
    // 3b. Mechanism object presence
    // At least one hypothesis must name a mechanism object:
    // a resource, component, boundary, config item, state constraint, or dependency.
    const mechanismObjects = extractMechanismObjects(hypothesisText);
    if (mechanismObjects.length === 0) {
        return {
            chain: "hypothesis → mechanism",
            issue: "Hypotheses do not name a plausible mechanism. A good hypothesis identifies a specific component, resource, configuration, or constraint that could cause the observed behavior (e.g. 'connection pool', 'cache TTL', 'permission boundary', 'queue backlog').",
            severity: "reject",
        };
    }
    // 3c. Intervention alignment
    // The intervention must operate on at least one mechanism object named in the hypothesis.
    // This prevents "hypothesis says X is broken, intervention fixes Y instead."
    const interventionAligned = mechanismObjects.some(obj => interventionText.includes(obj) || isRelatedTerm(obj, interventionText));
    // Also check rootCauseCandidate alignment if present
    const rootCauseAligned = frame.rootCauseCandidate
        ? extractMechanismObjects(frame.rootCauseCandidate.toLowerCase()).some(obj => interventionText.includes(obj) || isRelatedTerm(obj, interventionText))
        : false;
    if (!interventionAligned && !rootCauseAligned && mechanismObjects.length > 0) {
        return {
            chain: "hypothesis → intervention",
            issue: `Intervention does not appear to operate on the mechanism named in the hypothesis (${mechanismObjects.slice(0, 3).join(", ")}). The fix should target what the hypothesis identifies as the cause.`,
            severity: "reject",
        };
    }
    return null;
}
// Check 4 backstop: domain-level mismatch
// Used when mechanism objects are absent or ambiguous — catches gross mismatches
// like "hypothesis about network" + "intervention about database schema"
function checkDomainMismatch(frame) {
    const hypothesisText = frame.hypotheses.join(" ").toLowerCase();
    const interventionText = frame.proposedIntervention.toLowerCase();
    const rootCauseText = (frame.rootCauseCandidate || "").toLowerCase();
    const hypDomain = detectDomain(hypothesisText + " " + rootCauseText);
    const intDomain = detectDomain(interventionText);
    if (hypDomain && intDomain && hypDomain !== intDomain && !domainsOverlap(hypDomain, intDomain)) {
        return {
            chain: "hypothesis → intervention",
            issue: `Hypothesis domain (${hypDomain}) and intervention domain (${intDomain}) appear to be unrelated. The fix should address what the hypothesis identifies as the root cause.`,
            severity: "reject",
        };
    }
    return null;
}
// --- Mechanism object extraction ---
// Extracts concrete mechanism nouns: resources, components, boundaries, configs, states
const MECHANISM_PATTERNS = [
    // Resource/capacity
    { pattern: /connection\s*pool/g, label: "connection pool" },
    { pattern: /thread\s*pool/g, label: "thread pool" },
    { pattern: /memory\s*(leak|limit|budget|pressure)/g, label: "memory" },
    { pattern: /disk\s*(space|quota|full)/g, label: "disk" },
    { pattern: /queue\s*(backlog|depth|full|size)/g, label: "queue" },
    { pattern: /rate\s*limit/g, label: "rate limit" },
    { pattern: /timeout/g, label: "timeout" },
    { pattern: /deadlock/g, label: "deadlock" },
    { pattern: /race\s*condition/g, label: "race condition" },
    // Index/boundary
    { pattern: /off.by.one/g, label: "off-by-one" },
    { pattern: /index\s*(out|overflow|bound|calcu)/g, label: "index" },
    { pattern: /array\s*(bound|length|size)/g, label: "array bounds" },
    { pattern: /buffer\s*(overflow|underflow|size)/g, label: "buffer" },
    { pattern: /loop\s*(bound|condition|terminat)/g, label: "loop boundary" },
    // Config/state
    { pattern: /config(uration)?\s*(missing|wrong|invalid|stale)/g, label: "configuration" },
    { pattern: /env(ironment)?\s*(var|variable|missing|not set)/g, label: "environment variable" },
    { pattern: /cache\s*(invalid|miss|stale|ttl|expir)/g, label: "cache" },
    { pattern: /lock\s*(held|contention|timeout)/g, label: "lock" },
    { pattern: /state\s*(stale|corrupt|inconsistent)/g, label: "state" },
    // Dependency/boundary
    { pattern: /firewall\s*(rule|block|port)/g, label: "firewall" },
    { pattern: /permission\s*(denied|missing|boundary)/g, label: "permission" },
    { pattern: /dependency\s*(missing|version|conflict)/g, label: "dependency" },
    { pattern: /api\s*(contract|schema|version|break)/g, label: "api contract" },
    { pattern: /auth(entication|orization)?\s*(fail|token|expir)/g, label: "auth" },
    { pattern: /certificate\s*(expir|invalid|missing)/g, label: "certificate" },
    // Concurrency
    { pattern: /concurrent\s*(load|access|request)/g, label: "concurrency" },
    { pattern: /exhaust(ed|ion)/g, label: "resource exhaustion" },
    { pattern: /overflow/g, label: "overflow" },
    { pattern: /saturated|saturation/g, label: "saturation" },
];
function extractMechanismObjects(text) {
    const found = [];
    for (const { pattern, label } of MECHANISM_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(text)) {
            found.push(label);
        }
    }
    return found;
}
// Related term check: some mechanism objects map to natural intervention terms
const RELATED_TERMS = {
    "connection pool": ["pool", "max", "connections", "limit", "concurren"],
    "thread pool": ["thread", "pool", "worker", "concurren"],
    "memory": ["memory", "heap", "allocation", "leak", "free"],
    "timeout": ["timeout", "deadline", "retry", "wait"],
    "off-by-one": ["index", "bound", "<=", "<", "-1", "+1", "length"],
    "index": ["index", "offset", "position", "bound"],
    "array bounds": ["bound", "length", "index", "size"],
    "loop boundary": ["condition", "bound", "loop", "<=", "<"],
    "cache": ["cache", "ttl", "invalidat", "expir", "refresh"],
    "configuration": ["config", "setting", "parameter", "env", "value"],
    "environment variable": ["env", "config", "variable", "export", "set"],
    "permission": ["permission", "role", "acl", "grant", "allow"],
    "rate limit": ["rate", "throttle", "limit", "quota", "backoff"],
    "concurrency": ["concurrent", "parallel", "lock", "pool", "max"],
    "resource exhaustion": ["increase", "limit", "pool", "capacity", "scale"],
    "firewall": ["firewall", "port", "rule", "allow", "deny", "network"],
};
function isRelatedTerm(mechanismLabel, interventionText) {
    const related = RELATED_TERMS[mechanismLabel] || [];
    return related.some(term => interventionText.includes(term));
}
function detectDomain(text) {
    if (/firewall|port|packet|dns|network|socket|tcp|udp/.test(text))
        return "network";
    if (/database|sql|query|table|schema|migration|postgres|mysql/.test(text))
        return "database";
    // ui domain only if EXCLUSIVELY about rendering/display — not memory management in a UI context
    if (/\bdom\b|css|frontend|display|stylesheet/.test(text) && !/memory|leak|allocation/.test(text))
        return "ui";
    if (/file|disk|directory|path|inode|symlink/.test(text))
        return "filesystem";
    if (/memory|heap|malloc|gc|allocation|leak/.test(text))
        return "memory";
    if (/auth|token|session|credential|password|oauth|jwt/.test(text))
        return "authentication";
    return null;
}
function domainsOverlap(a, b) {
    // Some domains can legitimately co-occur in a fix
    const compatible = [
        ["network", "authentication"], // e.g. TLS cert issue → auth fix
        ["database", "memory"], // e.g. pool exhaustion → memory pressure
        ["filesystem", "authentication"], // e.g. file permission → auth
        ["memory", "ui"], // e.g. memory leak in UI component → fix is in component lifecycle
    ];
    return compatible.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}
// --- Restatement detection ---
function isRestatement(symptomText, hypothesisText) {
    const symptomWords = new Set(symptomText
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 3)
        .filter(w => !STOP_WORDS.has(w)));
    const hypothesisWords = hypothesisText
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 3)
        .filter(w => !STOP_WORDS.has(w));
    if (hypothesisWords.length === 0)
        return false;
    const overlapCount = hypothesisWords.filter(w => symptomWords.has(w)).length;
    const overlapRatio = overlapCount / hypothesisWords.length;
    // > 65% word overlap between hypothesis and symptoms = likely restatement
    return overlapRatio > 0.65;
}
// --- Other helpers (unchanged) ---
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
        "increase ", "decrease ", "change ", "set ", "enable ", "disable ",
        "grep ", "search ", "query ", "examine ", "trace ",
    ];
    return actionVerbs.some(v => lower.startsWith(v));
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
    "does", "just", "very", "only", "both", "such", "each", "even",
]);
