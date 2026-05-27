import type { Confidence, ProtocolId } from "./types.js";
export interface ScanEntry {
    path: string;
    protocol: ProtocolId;
    version?: string;
    confidence: Confidence;
    reason: string;
}
export interface RunnerEnv {
    inputs: Record<string, string | undefined>;
    GITHUB_OUTPUT?: string;
    GITHUB_EVENT_NAME?: string;
    GITHUB_REPOSITORY?: string;
    GITHUB_EVENT_PATH?: string;
    /** Walk dir + return JSON file paths. Defaults to fs.readdirSync recursive walk. */
    walk?: (dir: string) => string[];
    /** Read a file from disk. Defaults to fs.readFileSync. */
    readFile?: (path: string) => string;
    /** Predicate: does this path exist? Defaults to fs.existsSync. */
    exists?: (path: string) => boolean;
    /** Stubbed PR-comment poster for tests. */
    postComment?: (args: {
        token: string;
        repo: string;
        issueNumber: number;
        body: string;
    }) => Promise<void>;
    /** Output stream. */
    write?: (line: string) => void;
}
export interface RunnerResult {
    exitCode: 0 | 1;
    entries: ScanEntry[];
    unknownCount: number;
    commentPosted: boolean;
    reason?: string;
}
export declare function run(env: RunnerEnv): Promise<RunnerResult>;
