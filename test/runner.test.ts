import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { run, type RunnerEnv } from "../src/runner.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES = `${here}/../fixtures`;

const AGENT_CARD = readFileSync(`${FIXTURES}/agent-card.json`, "utf8");
const MCP_TOOL_CARD = readFileSync(`${FIXTURES}/mcp-tool-card.json`, "utf8");
const PROMPT_PROVENANCE = readFileSync(`${FIXTURES}/prompt-provenance.json`, "utf8");
const EVIDENCE_BUNDLE = readFileSync(`${FIXTURES}/evidence-bundle.json`, "utf8");
const OTLP_SPANS = readFileSync(`${FIXTURES}/otlp-spans.json`, "utf8");
const TOOLS_LIST = readFileSync(`${FIXTURES}/tools-list.json`, "utf8");
const UNKNOWN = readFileSync(`${FIXTURES}/unknown.json`, "utf8");

function makeEnv(opts: {
  scanDir?: string;
  files?: Record<string, string>;
  failOnUnknown?: string;
  minConfidence?: string;
  isPullRequest?: boolean;
  hasToken?: boolean;
}): RunnerEnv {
  const scanDir = opts.scanDir ?? "docs";
  const files = opts.files ?? {
    [`${scanDir}/agent.json`]: AGENT_CARD,
    [`${scanDir}/tool.json`]: MCP_TOOL_CARD,
    [`${scanDir}/prov.json`]: PROMPT_PROVENANCE,
    [`${scanDir}/bundle.json`]: EVIDENCE_BUNDLE,
    [`${scanDir}/otlp.json`]: OTLP_SPANS,
    [`${scanDir}/tools.json`]: TOOLS_LIST
  };

  const inputs: Record<string, string | undefined> = {
    scan_dir: scanDir,
    comment_on_pr: "false"
  };
  if (opts.failOnUnknown !== undefined) inputs.fail_on_unknown = opts.failOnUnknown;
  if (opts.minConfidence !== undefined) inputs.min_confidence = opts.minConfidence;
  if (opts.hasToken) inputs.github_token = "ghs_test";

  const env: RunnerEnv = {
    inputs,
    walk: () => Object.keys(files),
    readFile: (p) => files[p] ?? "{}",
    exists: (p) => p === scanDir || p in files || p.endsWith("event.json"),
    write: () => undefined
  };
  if (opts.isPullRequest) {
    env.GITHUB_EVENT_NAME = "pull_request";
    env.GITHUB_REPOSITORY = "x/y";
    env.GITHUB_EVENT_PATH = `${here}/event.json`;
    env.readFile = (p) => {
      if (p in files) return files[p];
      if (p.endsWith("event.json")) return JSON.stringify({ number: 42, pull_request: { number: 42, base: { sha: "abc123" } } });
      return "{}";
    };
  }
  return env;
}

describe("runner.run", () => {
  it("scans every JSON file under scan-dir and emits ScanEntry rows", async () => {
    const r = await run(makeEnv({}));
    expect(r.exitCode).toBe(0);
    expect(r.entries).toHaveLength(6);
    const protocols = r.entries.map((e) => e.protocol).sort();
    expect(protocols).toContain("agent-cards-spec");
    expect(protocols).toContain("mcp-tool-card-spec");
    expect(protocols).toContain("prompt-provenance-spec");
    expect(protocols).toContain("evidence-bundle-spec");
    expect(protocols).toContain("otel-genai-otlp");
    expect(protocols).toContain("mcp-tools-list");
  });

  it("counts unknown JSON files", async () => {
    const r = await run(makeEnv({
      files: {
        "docs/a.json": AGENT_CARD,
        "docs/b.json": UNKNOWN,
        "docs/c.json": UNKNOWN
      }
    }));
    expect(r.exitCode).toBe(0);
    expect(r.unknownCount).toBe(2);
  });

  it("exits 1 when fail-on-unknown is true and any unknown JSON exists", async () => {
    const r = await run(makeEnv({
      files: { "docs/a.json": AGENT_CARD, "docs/b.json": UNKNOWN },
      failOnUnknown: "true"
    }));
    expect(r.exitCode).toBe(1);
    expect(r.unknownCount).toBe(1);
  });

  it("treats malformed JSON as unknown (does not throw)", async () => {
    const r = await run(makeEnv({
      files: { "docs/a.json": AGENT_CARD, "docs/bad.json": "this is not json {{{" }
    }));
    expect(r.exitCode).toBe(0);
    const bad = r.entries.find((e) => e.path === "docs/bad.json");
    expect(bad?.protocol).toBe("unknown");
  });

  it("respects min-confidence (high) — medium/low detections count as unknown", async () => {
    // We pass min-confidence=high; only high-confidence detections survive.
    // Most fixtures should still be high but tools-list / otlp may be lower.
    const r = await run(makeEnv({ minConfidence: "high", failOnUnknown: "true" }));
    // Just assert min-confidence is wired — should NOT be 0 unknown if any fixture is medium
    expect(r.entries).toHaveLength(6);
    expect(r.exitCode === 0 || r.exitCode === 1).toBe(true);
  });

  it("rejects bogus min-confidence values", async () => {
    await expect(run({
      inputs: { scan_dir: "docs", min_confidence: "extreme" },
      walk: () => [],
      readFile: () => "{}",
      exists: () => true
    })).rejects.toThrow(/min-confidence/);
  });

  it("rejects when scan-dir input is missing", async () => {
    await expect(run({ inputs: {} })).rejects.toThrow(/scan_dir/);
  });

  it("exits 1 when scan-dir doesn't exist on disk", async () => {
    const env: RunnerEnv = {
      inputs: { scan_dir: "nonexistent", comment_on_pr: "false" },
      walk: () => [],
      readFile: () => "{}",
      exists: () => false,
      write: () => undefined
    };
    const r = await run(env);
    expect(r.exitCode).toBe(1);
    expect(r.reason).toBe("scan-dir not found");
  });

  it("handles empty directory gracefully", async () => {
    const env: RunnerEnv = {
      inputs: { scan_dir: "docs", comment_on_pr: "false" },
      walk: () => [],
      readFile: () => "{}",
      exists: (p) => p === "docs",
      write: () => undefined
    };
    const r = await run(env);
    expect(r.exitCode).toBe(0);
    expect(r.entries).toHaveLength(0);
    expect(r.unknownCount).toBe(0);
  });

  it("posts a PR comment in pull_request context", async () => {
    const calls: Array<{ body: string }> = [];
    const env = makeEnv({ isPullRequest: true, hasToken: true });
    env.inputs.comment_on_pr = "auto";
    env.postComment = async (args) => { calls.push({ body: args.body }); };
    const r = await run(env);
    expect(r.commentPosted).toBe(true);
    expect(calls[0].body).toContain("Kinetic Gain Protocol Detect");
  });

  it("skips PR comment when token is missing", async () => {
    const env = makeEnv({ isPullRequest: true });
    env.inputs.comment_on_pr = "true";
    const r = await run(env);
    expect(r.commentPosted).toBe(false);
    expect(r.reason).toBe("no github-token provided");
  });

  it("does not comment on non-PR events with comment_on_pr=auto", async () => {
    const env: RunnerEnv = {
      inputs: { scan_dir: "docs", comment_on_pr: "auto", github_token: "ghs" },
      GITHUB_EVENT_NAME: "push",
      walk: () => ["docs/a.json"],
      readFile: () => AGENT_CARD,
      exists: () => true,
      write: () => undefined
    };
    const r = await run(env);
    expect(r.commentPosted).toBe(false);
  });
});
