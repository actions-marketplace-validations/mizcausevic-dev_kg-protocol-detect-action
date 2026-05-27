# kg-protocol-detect-action

[![CI](https://github.com/mizcausevic-dev/kg-protocol-detect-action/actions/workflows/ci.yml/badge.svg)](https://github.com/mizcausevic-dev/kg-protocol-detect-action/actions/workflows/ci.yml)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/License-AGPL--3.0--or--later-blue.svg)](LICENSE)

GitHub Action that **scans a directory of JSON documents and identifies which Kinetic Gain Suite protocol each one belongs to**. Useful for mixed-content repos where AgentCards, MCP Tool Cards, prompt-provenance docs, evidence bundles, and OTel GenAI traces all live side by side and need to be triaged into the right per-protocol diff/stamp pipeline.

Wraps [`kg-protocol-detect`](https://github.com/mizcausevic-dev/kg-protocol-detect). Pairs naturally with the per-protocol diff Action quintet.

Part of the [Kinetic Gain Suite](https://suite.kineticgain.com/).

---

## Usage

```yaml
name: Protocol inventory
on:
  pull_request:
    paths: ["governance/**/*.json"]

jobs:
  protocol-detect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: mizcausevic-dev/kg-protocol-detect-action@v0.1-shipped
        with:
          scan-dir: governance
          fail-on-unknown: true
          min-confidence: medium
```

## Inputs

| input              | required | default | description |
|---|---|---|---|
| `scan-dir`         | ✓        | —       | Directory to walk recursively for JSON documents. |
| `fail-on-unknown`  |          | `false` | Fail the run when any file is identified as `protocol=unknown` (or below `min-confidence`). |
| `min-confidence`   |          | `low`   | One of `high`, `medium`, `low`. Detections below this rank count as "unknown" for the gate. |
| `comment-on-pr`    |          | `auto`  | Post the protocol summary as a PR comment. |
| `github-token`     |          | `${{ github.token }}` | Token for posting the PR comment. |

## Outputs

| output          | description |
|---|---|
| `file-count`    | Number of JSON files scanned. |
| `unknown-count` | Number of files identified as `unknown` (or below `min-confidence`). |
| `summary-json`  | Compact JSON array of `{ path, protocol, version, confidence }` per file. |

## What it detects

Recognized protocols (per [`kg-protocol-detect`](https://github.com/mizcausevic-dev/kg-protocol-detect)):

- `agent-cards-spec` — A2A AgentCard documents
- `mcp-tool-card-spec` — MCP Tool Card documents
- `prompt-provenance-spec` — prompt-provenance documents
- `evidence-bundle-spec` — evidence-bundle manifests
- `otel-genai-otlp` — OTLP export envelopes carrying OTel GenAI spans
- `mcp-tools-list` — bare MCP `tools/list` server responses
- `unknown` — anything else

Detection is shape- and discriminator-based — files without a `*_version` field still get matched on well-known shape signals.

## How it composes

- After detection, route each protocol to its diff/stamp/readme-generator pipeline.
- Output `summary-json` can be consumed by downstream jobs via `fromJSON()`.
- Pair with the per-protocol diff Action quintet for full PR gating: [agent-card-diff-action](https://github.com/mizcausevic-dev/agent-card-diff-action), [mcp-tool-card-diff-action](https://github.com/mizcausevic-dev/mcp-tool-card-diff-action), [prompt-provenance-diff-action](https://github.com/mizcausevic-dev/prompt-provenance-diff-action), [evidence-bundle-diff-action](https://github.com/mizcausevic-dev/evidence-bundle-diff-action), [otel-genai-diff-action](https://github.com/mizcausevic-dev/otel-genai-diff-action).

## License

[AGPL-3.0-or-later](LICENSE)
