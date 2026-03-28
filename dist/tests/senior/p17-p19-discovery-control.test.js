"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = require("node:assert");
const node_test_1 = require("node:test");
const p17_p19_discovery_control_1 = require("../../src/policies/senior/p17-p19-discovery-control");
// --- Base input helpers ---
function baseInput(overrides = {}) {
    return {
        task: { objective: "Fix failing test in discount module" },
        proposal: {
            summary: "Analyze and fix the discount calculation bug",
            plannedActions: [
                { type: "read", intent: "read the failing test output" },
                { type: "analysis", intent: "trace the calculation path" },
                { type: "write", intent: "fix the off-by-one in discount.ts" },
            ],
        },
        evidence: {
            observations: ["test fails with wrong discount value"],
            failureSignals: [],
        },
        ...overrides,
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// P17 — Externalize and Split on Discovery
// ─────────────────────────────────────────────────────────────────────────────
(0, node_test_1.describe)("P17 — Externalize and Split on Discovery", () => {
    (0, node_test_1.test)("no violations — clean single-concern proposal with no failures", () => {
        const input = baseInput();
        const violations = (0, p17_p19_discovery_control_1.p17ExternalizeOnDiscovery)(input);
        node_assert_1.strict.equal(violations.length, 0);
    });
    (0, node_test_1.test)("no violations — multi-concern proposal with discoveries recorded", () => {
        const input = baseInput({
            proposal: {
                summary: "Fix multiple issues discovered",
                plannedActions: [
                    { type: "read", intent: "read test output" },
                    { type: "write", intent: "fix database schema migration" },
                    { type: "write", intent: "update auth token configuration" },
                    { type: "command", intent: "run CI pipeline to verify" },
                ],
            },
            discoveries: [
                { id: "disc-001", summary: "Schema migration pending before tests run", type: "blocker", resolvedInline: true },
                { id: "disc-002", summary: "Auth token expiry config out of date", type: "followup" },
            ],
        });
        const violations = (0, p17_p19_discovery_control_1.p17ExternalizeOnDiscovery)(input);
        node_assert_1.strict.equal(violations.length, 0);
    });
    (0, node_test_1.test)("warning — proposal spans 3+ distinct concern areas with no discoveries", () => {
        const input = baseInput({
            proposal: {
                summary: "Fix everything found",
                plannedActions: [
                    { type: "write", intent: "fix database migration schema issue" },
                    { type: "write", intent: "update auth token configuration" },
                    { type: "command", intent: "run CI pipeline lint checks" },
                    { type: "write", intent: "update API endpoint route handler" },
                ],
            },
        });
        const violations = (0, p17_p19_discovery_control_1.p17ExternalizeOnDiscovery)(input);
        const p17 = violations.find(v => v.policyId === "P17");
        node_assert_1.strict.ok(p17, "should have P17 violation");
        node_assert_1.strict.equal(p17.severity, "warning");
        node_assert_1.strict.ok(p17.message.includes("distinct concern"));
    });
    (0, node_test_1.test)("reject — multiple failure signals with no discoveries", () => {
        const input = baseInput({
            evidence: {
                failureSignals: ["terraform_not_found", "schema_mismatch"],
                observations: [],
            },
        });
        const violations = (0, p17_p19_discovery_control_1.p17ExternalizeOnDiscovery)(input);
        const p17 = violations.find(v => v.policyId === "P17");
        node_assert_1.strict.ok(p17, "should have P17 violation");
        node_assert_1.strict.equal(p17.severity, "reject");
        node_assert_1.strict.ok(p17.message.includes("failure signal"));
    });
    (0, node_test_1.test)("warning — discovery with no type classification", () => {
        const input = baseInput({
            discoveries: [
                { id: "disc-001", summary: "Found unexpected state in config", type: undefined },
            ],
        });
        const violations = (0, p17_p19_discovery_control_1.p17ExternalizeOnDiscovery)(input);
        const p17 = violations.find(v => v.policyId === "P17" && v.message.includes("no type"));
        node_assert_1.strict.ok(p17, "should warn about missing type");
        node_assert_1.strict.equal(p17.severity, "warning");
    });
    (0, node_test_1.test)("warning — discovery with empty summary", () => {
        const input = baseInput({
            discoveries: [
                { id: "disc-002", summary: "ok", type: "followup" },
            ],
        });
        const violations = (0, p17_p19_discovery_control_1.p17ExternalizeOnDiscovery)(input);
        const p17 = violations.find(v => v.policyId === "P17" && v.message.includes("summary"));
        node_assert_1.strict.ok(p17, "should warn about insufficient summary");
        node_assert_1.strict.equal(p17.severity, "warning");
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// P18 — Blocker Precedence
// ─────────────────────────────────────────────────────────────────────────────
(0, node_test_1.describe)("P18 — Blocker Precedence", () => {
    (0, node_test_1.test)("no violations — no blockers and no gating signals", () => {
        const input = baseInput();
        const violations = (0, p17_p19_discovery_control_1.p18BlockerPrecedence)(input);
        node_assert_1.strict.equal(violations.length, 0);
    });
    (0, node_test_1.test)("no violations — blocker recorded and resolved inline", () => {
        const input = baseInput({
            discoveries: [
                { id: "disc-001", summary: "terraform not installed", type: "blocker", resolvedInline: true },
            ],
        });
        const violations = (0, p17_p19_discovery_control_1.p18BlockerPrecedence)(input);
        node_assert_1.strict.equal(violations.length, 0);
    });
    (0, node_test_1.test)("block — unresolved blocker while proposal proceeds", () => {
        const input = baseInput({
            discoveries: [
                { id: "disc-001", summary: "DB schema migration is pending", type: "blocker", resolvedInline: false },
            ],
        });
        const violations = (0, p17_p19_discovery_control_1.p18BlockerPrecedence)(input);
        const p18 = violations.find(v => v.policyId === "P18");
        node_assert_1.strict.ok(p18, "should have P18 block violation");
        node_assert_1.strict.equal(p18.severity, "block");
        node_assert_1.strict.ok(p18.message.includes("unresolved blocker"));
    });
    (0, node_test_1.test)("block — 'not found' signal in evidence while mutating actions proceed", () => {
        const input = baseInput({
            evidence: {
                observations: ["terraform: command not found in PATH"],
                failureSignals: [],
            },
        });
        const violations = (0, p17_p19_discovery_control_1.p18BlockerPrecedence)(input);
        const p18 = violations.find(v => v.policyId === "P18");
        node_assert_1.strict.ok(p18, "should have P18 block violation for tool not found");
        node_assert_1.strict.equal(p18.severity, "block");
    });
    (0, node_test_1.test)("block — 'permission denied' signal with write actions", () => {
        const input = baseInput({
            evidence: {
                observations: ["Error: permission denied writing to /etc/config"],
                failureSignals: [],
            },
        });
        const violations = (0, p17_p19_discovery_control_1.p18BlockerPrecedence)(input);
        const p18 = violations.find(v => v.policyId === "P18");
        node_assert_1.strict.ok(p18, "should block on permission denied");
        node_assert_1.strict.equal(p18.severity, "block");
    });
    (0, node_test_1.test)("no block — 'not found' signal but no mutating actions", () => {
        const input = baseInput({
            proposal: {
                summary: "Only reading and analysis",
                plannedActions: [
                    { type: "read", intent: "read config file" },
                    { type: "analysis", intent: "analyze the error message" },
                ],
            },
            evidence: {
                observations: ["terraform: command not found"],
                failureSignals: [],
            },
        });
        const violations = (0, p17_p19_discovery_control_1.p18BlockerPrecedence)(input);
        // May warn from P17 but should not BLOCK from P18
        const p18Block = violations.find(v => v.policyId === "P18" && v.severity === "block");
        node_assert_1.strict.equal(p18Block, undefined, "should not block when no mutating actions");
    });
    (0, node_test_1.test)("block — merge conflict signal with write actions", () => {
        const input = baseInput({
            evidence: {
                commandResults: ["error: merge conflict in src/main.ts cannot merge"],
                failureSignals: [],
            },
        });
        const violations = (0, p17_p19_discovery_control_1.p18BlockerPrecedence)(input);
        const p18 = violations.find(v => v.policyId === "P18");
        node_assert_1.strict.ok(p18, "should block on merge conflict");
        node_assert_1.strict.equal(p18.severity, "block");
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// P19 — Context / Scope Budget
// ─────────────────────────────────────────────────────────────────────────────
(0, node_test_1.describe)("P19 — Context Budget", () => {
    (0, node_test_1.test)("no violations — narrow well-scoped proposal", () => {
        const input = baseInput();
        const violations = (0, p17_p19_discovery_control_1.p19ContextBudget)(input);
        node_assert_1.strict.equal(violations.length, 0);
    });
    (0, node_test_1.test)("reject — openBranches exceeds limit", () => {
        const input = baseInput({
            executionBudget: { openBranches: 6 },
        });
        const violations = (0, p17_p19_discovery_control_1.p19ContextBudget)(input);
        const p19 = violations.find(v => v.policyId === "P19");
        node_assert_1.strict.ok(p19, "should have P19 violation");
        node_assert_1.strict.equal(p19.severity, "reject");
        node_assert_1.strict.ok(p19.message.includes("open branches"));
    });
    (0, node_test_1.test)("reject — concurrentFindings exceeds limit", () => {
        const input = baseInput({
            executionBudget: { concurrentFindings: 4 },
        });
        const violations = (0, p17_p19_discovery_control_1.p19ContextBudget)(input);
        const p19 = violations.find(v => v.policyId === "P19");
        node_assert_1.strict.ok(p19, "should have P19 violation");
        node_assert_1.strict.equal(p19.severity, "reject");
        node_assert_1.strict.ok(p19.message.includes("concurrent findings"));
    });
    (0, node_test_1.test)("warning — subsystemsTouched exceeds limit", () => {
        const input = baseInput({
            executionBudget: {
                subsystemsTouched: ["auth", "database", "api", "cache"],
            },
        });
        const violations = (0, p17_p19_discovery_control_1.p19ContextBudget)(input);
        const p19 = violations.find(v => v.policyId === "P19");
        node_assert_1.strict.ok(p19, "should have P19 violation");
        node_assert_1.strict.equal(p19.severity, "warning");
        node_assert_1.strict.ok(p19.message.includes("subsystem"));
    });
    (0, node_test_1.test)("warning — many unresolved non-blocker discoveries accumulate", () => {
        const input = baseInput({
            discoveries: [
                { id: "d1", summary: "Found linting issues in 5 files", type: "followup" },
                { id: "d2", summary: "README outdated in 3 sections", type: "followup" },
                { id: "d3", summary: "CI config uses deprecated syntax", type: "followup" },
                { id: "d4", summary: "Test coverage below 80% in auth module", type: "followup" },
            ],
        });
        const violations = (0, p17_p19_discovery_control_1.p19ContextBudget)(input);
        const p19 = violations.find(v => v.policyId === "P19");
        node_assert_1.strict.ok(p19, "should warn about accumulating discoveries");
        node_assert_1.strict.equal(p19.severity, "warning");
    });
    (0, node_test_1.test)("no violation — discoveries marked spawnSuggested don't count toward budget", () => {
        const input = baseInput({
            discoveries: [
                { id: "d1", summary: "Found linting issues", type: "followup", spawnSuggested: true },
                { id: "d2", summary: "README outdated", type: "followup", spawnSuggested: true },
                { id: "d3", summary: "CI config deprecated", type: "followup", spawnSuggested: true },
                { id: "d4", summary: "Test coverage low", type: "followup", spawnSuggested: true },
            ],
        });
        const violations = (0, p17_p19_discovery_control_1.p19ContextBudget)(input);
        const p19 = violations.find(v => v.policyId === "P19");
        node_assert_1.strict.equal(p19, undefined, "spawn-suggested discoveries should not count toward budget");
    });
    (0, node_test_1.test)("warning — proposal intent areas span too many distinct concerns", () => {
        const input = baseInput({
            proposal: {
                summary: "Fix everything at once",
                plannedActions: [
                    { type: "write", intent: "fix database schema migration issue" },
                    { type: "command", intent: "update auth token configuration setting" },
                    { type: "write", intent: "update CI pipeline workflow yaml" },
                    { type: "write", intent: "fix API endpoint route handler" },
                    { type: "command", intent: "install missing npm package dependency" },
                ],
            },
        });
        const violations = (0, p17_p19_discovery_control_1.p19ContextBudget)(input);
        const p19 = violations.find(v => v.policyId === "P19" && v.message.includes("concern"));
        node_assert_1.strict.ok(p19, "should warn about too many concern areas");
        node_assert_1.strict.equal(p19.severity, "warning");
    });
});
