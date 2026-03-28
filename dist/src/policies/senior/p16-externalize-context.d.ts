import { Input, Violation } from "../../types";
/**
 * P16 — Externalize Working Context
 *
 * Principle: Task-critical working context must be externalized into durable project artifacts.
 * The agent must not rely on transient memory for reasoning that affects action, retry, or completion.
 *
 * Slogan: "Memory is not state"
 */
export declare function p16ExternalizeContext(input: Input): Violation[];
