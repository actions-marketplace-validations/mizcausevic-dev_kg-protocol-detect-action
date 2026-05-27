# Changelog

## v0.1.0 — 2026-05-27

- Initial release: GitHub Action wrapping `kg-protocol-detect` as a directory-scan protocol identifier.
- Inputs: `scan-dir` (required), `fail-on-unknown` (default false), `min-confidence` (default `low`), `comment-on-pr` (auto/true/false), `github-token`.
- Outputs: `file-count`, `unknown-count`, `summary-json`.
- Recursively walks `scan-dir` for `*.json` files, identifies each one's protocol (`agent-cards-spec`, `mcp-tool-card-spec`, `prompt-provenance-spec`, `evidence-bundle-spec`, `otel-genai-otlp`, `mcp-tools-list`, or `unknown`).
- Handles malformed JSON gracefully — files that fail to parse are recorded as `unknown` with the parse-error reason.
- `min-confidence` gate lets you treat low/medium detections as unknown when desired.
- Pairs with the per-protocol diff Action quintet: route each detected protocol to its `*-diff-action` for full PR gating.
- Composite Node 20 action with `dist/index.js` committed for SHA/tag pinning.
- 12 tests with injected `walk`/`readFile` for hermetic execution.
- 7 fixtures spanning every supported protocol + an `unknown.json` for failure-case coverage.
- Node 20/22 CI (lint, typecheck, coverage, build, `npm audit`), AGPL-3.0-or-later, Dependabot.
