"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.p7Hygiene = void 0;
const SIZE_DELTA_LIMIT = 50000000; // 50MB
const DIRTY_FILE_PATTERNS = [".terraform", ".terraform/", ".tfstate", "terraform.tfstate"];
/**
 * P7 — Hygiene Preservation (high priority: block)
 * Blocks proposals that would contaminate the repository with
 * large files, state files, or Terraform artifacts.
 */
const p7Hygiene = (input) => {
    const violations = [];
    const diff = input.evidence?.fileDiffSummary;
    if (!diff)
        return violations;
    // Check size delta
    if (diff.sizeDelta !== undefined && diff.sizeDelta > SIZE_DELTA_LIMIT) {
        violations.push({
            policyId: "P7",
            severity: "block",
            message: `Repository size delta ${diff.sizeDelta} bytes exceeds limit of ${SIZE_DELTA_LIMIT} bytes (50 MB). Hygiene violation: large artifact committed.`,
        });
    }
    // Check for dirty files
    for (const file of diff.changedFiles) {
        const isDirectoryPath = file.endsWith("/") || file.startsWith(".terraform/");
        const isDirtyFile = DIRTY_FILE_PATTERNS.some((pattern) => file === pattern ||
            file.startsWith(pattern) ||
            file.includes(pattern) ||
            (pattern.includes("*") && matchesGlob(file, pattern)));
        if (isDirtyFile) {
            violations.push({
                policyId: "P7",
                severity: "block",
                message: `File "${file}" matches dirty/excluded pattern. Do not commit Terraform state or provider artifacts.`,
            });
        }
        void isDirectoryPath;
    }
    // Check for large files added
    if (diff.largeFilesAdded !== undefined && diff.largeFilesAdded > 0) {
        violations.push({
            policyId: "P7",
            severity: "block",
            message: `${diff.largeFilesAdded} large file(s) added in this changeset. Remove large binaries or generated artifacts before committing.`,
        });
    }
    return violations;
};
exports.p7Hygiene = p7Hygiene;
function matchesGlob(file, pattern) {
    // Simple glob: only supports leading * wildcard
    if (pattern.startsWith("*")) {
        const suffix = pattern.slice(1);
        return file.endsWith(suffix);
    }
    return file === pattern;
}
