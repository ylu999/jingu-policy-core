"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const p15_future_integrity_1 = require("../../src/policies/senior/p15-future-integrity");
function makeFrame(overrides = {}) {
    return {
        coreTension: "Security vs developer velocity in secret management",
        problemLayer: "architecture",
        symptoms: ["secrets hardcoded in config files"],
        hypotheses: ["no secret management process defined"],
        verifiedFacts: ["API keys found in git history"],
        tradeoffs: ["convenience vs security"],
        proposedIntervention: "Migrate all secrets to Vault and rotate compromised keys",
        recurrencePrevention: "Add pre-commit hook to detect secrets, enforce secret scanning in CI",
        ...overrides,
    };
}
function makeInput(frame) {
    return {
        task: { objective: "fix secret leakage" },
        proposal: { summary: "migrate to vault", plannedActions: [] },
        reasoningFrame: frame,
    };
}
(0, node_test_1.describe)("P15 — Future-State Integrity", () => {
    (0, node_test_1.it)("returns no violations when no reasoningFrame provided", () => {
        const result = (0, p15_future_integrity_1.p15FutureIntegrity)(makeInput());
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("returns no violations when recurrencePrevention is documented", () => {
        const result = (0, p15_future_integrity_1.p15FutureIntegrity)(makeInput(makeFrame()));
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("warns when recurrencePrevention is not set", () => {
        const frameWithoutPrevention = makeFrame();
        delete frameWithoutPrevention.recurrencePrevention;
        const result = (0, p15_future_integrity_1.p15FutureIntegrity)(makeInput(frameWithoutPrevention));
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P15");
        strict_1.default.equal(result[0].severity, "warning");
        strict_1.default.match(result[0].message, /recurrencePrevention/);
    });
    (0, node_test_1.it)("warns when recurrencePrevention is empty string", () => {
        const result = (0, p15_future_integrity_1.p15FutureIntegrity)(makeInput(makeFrame({ recurrencePrevention: "" })));
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P15");
        strict_1.default.equal(result[0].severity, "warning");
    });
    (0, node_test_1.it)("warns when recurrencePrevention is only whitespace", () => {
        const result = (0, p15_future_integrity_1.p15FutureIntegrity)(makeInput(makeFrame({ recurrencePrevention: "   " })));
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P15");
        strict_1.default.equal(result[0].severity, "warning");
    });
});
