import { Input, Violation } from "../../types";
/**
 * P7 — Hygiene Preservation (high priority: block)
 * Blocks proposals that would contaminate the repository with
 * large files, state files, or Terraform artifacts.
 */
export declare const p7Hygiene: (input: Input) => Violation[];
