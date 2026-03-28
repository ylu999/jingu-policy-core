"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const p1_constraint_obedience_1 = require("../../src/policies/discipline/p1-constraint-obedience");
function makeInput(overrides = {}) {
    return {
        task: { objective: "deploy infrastructure" },
        proposal: { summary: "deploy with terraform", plannedActions: [] },
        ...overrides,
    };
}
(0, node_test_1.describe)("P1 — Constraint Obedience", () => {
    (0, node_test_1.it)("returns no violations when no constraints defined", () => {
        const input = makeInput({
            proposal: {
                summary: "deploy",
                plannedActions: [
                    { type: "command", command: "aws ec2 create-instance", intent: "create EC2" },
                ],
            },
        });
        const result = (0, p1_constraint_obedience_1.p1ConstraintObedience)(input);
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("rejects action that violates terraform_only constraint", () => {
        const input = makeInput({
            task: {
                objective: "deploy",
                constraints: { explicitConstraints: ["terraform_only"] },
            },
            proposal: {
                summary: "deploy via aws cli",
                plannedActions: [
                    { type: "command", command: "aws ec2 create-instance", intent: "create EC2 instance" },
                ],
            },
        });
        const result = (0, p1_constraint_obedience_1.p1ConstraintObedience)(input);
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P1");
        strict_1.default.equal(result[0].severity, "reject");
        strict_1.default.match(result[0].message, /terraform_only/);
    });
    (0, node_test_1.it)("returns no violations when terraform_only constraint is respected", () => {
        const input = makeInput({
            task: {
                objective: "deploy",
                constraints: { explicitConstraints: ["terraform_only"] },
            },
            proposal: {
                summary: "deploy via terraform",
                plannedActions: [
                    { type: "command", command: "terraform apply", intent: "apply terraform plan" },
                ],
            },
        });
        const result = (0, p1_constraint_obedience_1.p1ConstraintObedience)(input);
        strict_1.default.deepEqual(result, []);
    });
    (0, node_test_1.it)("returns violation for no_write constraint when write action present", () => {
        const input = makeInput({
            task: {
                objective: "read only task",
                constraints: { explicitConstraints: ["no_write"] },
            },
            proposal: {
                summary: "write config file",
                plannedActions: [
                    { type: "write", intent: "write config" },
                ],
            },
        });
        const result = (0, p1_constraint_obedience_1.p1ConstraintObedience)(input);
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P1");
        strict_1.default.equal(result[0].severity, "reject");
    });
    (0, node_test_1.it)("returns violation for read_only constraint when command action present", () => {
        const input = makeInput({
            task: {
                objective: "read only task",
                constraints: { explicitConstraints: ["read_only"] },
            },
            proposal: {
                summary: "run command",
                plannedActions: [
                    { type: "command", command: "rm -rf /tmp/test", intent: "clean up" },
                ],
            },
        });
        const result = (0, p1_constraint_obedience_1.p1ConstraintObedience)(input);
        strict_1.default.equal(result.length, 1);
        strict_1.default.equal(result[0].policyId, "P1");
    });
    (0, node_test_1.it)("multiple violations for multiple violating actions", () => {
        const input = makeInput({
            task: {
                objective: "deploy",
                constraints: { explicitConstraints: ["terraform_only"] },
            },
            proposal: {
                summary: "deploy via aws cli",
                plannedActions: [
                    { type: "command", command: "aws ec2 create-instance", intent: "create EC2" },
                    { type: "command", command: "gcloud compute instances create", intent: "create GCE" },
                ],
            },
        });
        const result = (0, p1_constraint_obedience_1.p1ConstraintObedience)(input);
        strict_1.default.equal(result.length, 2);
    });
});
