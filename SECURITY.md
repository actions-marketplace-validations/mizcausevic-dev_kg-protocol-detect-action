# Security Policy

`kg-protocol-detect-action` reads JSON files under `scan-dir` at the workflow's checkout HEAD, posts a single PR comment via the GitHub API (when run on a pull_request event with a valid token), and writes structured outputs. No remote fetch beyond the GitHub API comment call, no execution of user-supplied code.

The action uses `${{ github.token }}` by default — scoped to the repository where the workflow runs and never persisted. If you provide your own token via the `github-token` input, ensure it has only `pull-requests: write` permissions.

Files are parsed via `JSON.parse` without `eval` or `Function()`. Malformed JSON is caught and recorded as `unknown` rather than crashing the run. The directory walk is constrained to `scan-dir` (and its subdirectories) — paths outside that root are never read.

## Supported versions

Only the latest tagged release is supported.

## Reporting a vulnerability

Please use GitHub Security Advisories for private disclosure:

- [Open a security advisory](https://github.com/mizcausevic-dev/kg-protocol-detect-action/security/advisories/new)

Do not file public issues for security reports.
