"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const p7_hygiene_1 = require("../../src/policies/discipline/p7-hygiene");
function makeInput(overrides = {}) {
    return {
        task: { objective: "deploy" },
        proposal: { summary: "deploy", plannedActions: [] },
        ...overrides,
    };
}
(0, node_test_1.describe)("P7 — Hygiene Preservation", () => {
    (0, node_test_1.it)("returns no violations when no fileDiffSummary", () => {
        const input = makeInput({ evidence: {} });
        const result = (0, p7_hygiene_1.p7Hygiene)(input);
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("blocks when sizeDelta exceeds 50MB", () => {
        const input = makeInput({
            evidence: {
                fileDiffSummary: {
                    changedFiles: ["main.tf"],
                    sizeDelta: 60000000,
                },
            },
        });
        const result = (0, p7_hygiene_1.p7Hygiene)(input);
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P7");
        strict_1.default.equal(result[0].severity, "block");
        strict_1.default.match(result[0].message, /50 MB/);
    });
    (0, node_test_1.it)("blocks when .terraform directory is in changedFiles", () => {
        const input = makeInput({
            evidence: {
                fileDiffSummary: {
                    changedFiles: [".terraform/providers/registry.terraform.io/hashicorp/aws/3.0.0/linux_amd64/terraform-provider-aws_v3.0.0"],
                },
            },
        });
        const result = (0, p7_hygiene_1.p7Hygiene)(input);
        strict_1.default.equal(result.length >= 1, true);
        strict_1.default.equal(result[0].policyId, "P7");
        strict_1.default.equal(result[0].severity, "block");
    });
    (0, node_test_1.it)("blocks when .tfstate file is in changedFiles", () => {
        const input = makeInput({
            evidence: {
                fileDiffSummary: {
                    changedFiles: ["terraform.tfstate"],
                },
            },
        });
        const result = (0, p7_hygiene_1.p7Hygiene)(input);
        strict_1.default.equal(result.length >= 1, true);
        strict_1.default.equal(result[0].policyId, "P7");
        strict_1.default.equal(result[0].severity, "block");
    });
    (0, node_test_1.it)("blocks when largeFilesAdded > 0", () => {
        const input = makeInput({
            evidence: {
                fileDiffSummary: {
                    changedFiles: [],
                    largeFilesAdded: 2,
                },
            },
        });
        const result = (0, p7_hygiene_1.p7Hygiene)(input);
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P7");
        strict_1.default.equal(result[0].severity, "block");
        strict_1.default.match(result[0].message, /2 large file/);
    });
    (0, node_test_1.it)("returns no violations for clean small changeset", () => {
        const input = makeInput({
            evidence: {
                fileDiffSummary: {
                    changedFiles: ["main.tf", "variables.tf"],
                    sizeDelta: 1024,
                    largeFilesAdded: 0,
                },
            },
        });
        const result = (0, p7_hygiene_1.p7Hygiene)(input);
        strict_1.default.deepEqual(result, []);
    });
});
