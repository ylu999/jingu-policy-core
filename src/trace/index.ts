// trace/index.ts
// Barrel export for trace module — merged from @jingu/trace (p227-09)

export { LoopEmitter } from "./emitter/loop-emitter.js"
export { FileEventSink, createFileEventSink } from "./sink/file-sink.js"
export { noopEventSink } from "./sink/noop-sink.js"
export { NORMALIZE_WHITELIST, NORMALIZE_FIELDS, stripVolatileField, stripVolatileFields } from "./normalize.js"
export type { NormalizeField } from "./normalize.js"
export { assertTraceEquivalence } from "./assert.js"
