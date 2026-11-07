/**
 * Sample sessions for the tests and the dev server. Nothing here ships, and the build test
 * checks that with sampleStrings().
 *
 * makeScenarios(now) gives each sample session its own id and key, covering the states of
 * session-page-ui.md 4 that come from the route. Each scenario lists the answers of
 * POST /v1/s/<id> in order, as the plain JSON the sessions route sends, and a scripted live
 * stream per job seq for the running one. Times are relative to `now`, so the dev server always
 * shows a fresh session.
 *
 * Every scenario that carries data puts `zz-sample-<name>` in a command and in a label, so a
 * leak into dist/ is easy to find.
 */
import { createHash } from "node:crypto";

export type ScenarioName =
    | "ended-full"
    | "ended-pending"
    | "ended-output-expired"
    | "ended-partial"
    | "ended-empty"
    | "ended-crowded"
    | "ended-hostile"
    | "ended-x402"
    | "ended-x402-settling"
    | "ended-x402-kept"
    | "ended-x402-reconcile"
    | "running"
    | "expired"
    | "too-new"
    | "rate-limited"
    | "deletable";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
export type WireFrame = { s: "o" | "e"; t: string; cr: boolean };

export interface GetAnswer {
    status: 200 | 429;
    body: JsonObject | null;
}

export interface LiveExit {
    exitCode: number | null;
    oom: boolean;
    peakMib: number;
}

// A null exit means the job is still running when its frames run out
export interface LiveScript {
    frames: WireFrame[];
    exit: LiveExit | null;
}

export interface Scenario {
    id: string;
    key: string;
    kind: ScenarioName;
    // The route answers these in order and repeats the last one
    gets: GetAnswer[];
    live: Record<number, LiveScript>;
}

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const NETWORK = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

/* Names, ids, keys and signatures */

function digest(text: string): Buffer {
    return createHash("sha256").update(text).digest();
}

function sentinel(name: ScenarioName): string {
    return `zz-sample-${name}`;
}

// Fixed per name, so the links pnpm dev prints keep working across restarts
function sampleId(name: ScenarioName): string {
    const base32 = "abcdefghijklmnopqrstuvwxyz234567";
    const bytes = digest(`zz-sample-id:${name}`).subarray(0, 16);
    return Array.from(bytes, (b) => base32[b & 31]).join("");
}

function sampleKey(name: ScenarioName): string {
    return `bnk_${digest(`zz-sample-key:${name}`).toString("base64url")}`;
}

export function base58(bytes: Uint8Array): string {
    const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let n = 0n;
    for (const b of bytes) n = (n << 8n) | BigInt(b);
    let text = "";
    for (; n > 0n; n /= 58n) text = alphabet[Number(n % 58n)] + text;
    for (const b of bytes) {
        if (b !== 0) break;
        text = `1${text}`;
    }
    return text;
}

// 64 bytes, as a Solana signature, whose top bytes are set so the base58 has the given length
export function sampleTx(seed: string, length: 86 | 87 | 88 = 88): string {
    const bytes = Buffer.concat([
        digest(`zz-sample-tx:${seed}:0`),
        digest(`zz-sample-tx:${seed}:1`),
    ]);
    if (length === 88) {
        bytes[0] = bytes[0]! | 0x80;
    } else if (length === 87) {
        bytes[0] = 1 + (bytes[0]! % 32);
    } else {
        bytes[0] = 0;
        bytes[1] = 1 + (bytes[1]! % 2);
    }
    return base58(bytes);
}

/* Frames and jobs */

const out = (t: string): WireFrame => ({ s: "o", t, cr: false });
const err = (t: string): WireFrame => ({ s: "e", t, cr: false });
const over = (t: string, s: "o" | "e" = "o"): WireFrame => ({ s, t, cr: true });

function bar(percent: number, width = 20): string {
    const filled = Math.round((percent / 100) * width);
    return `${"━".repeat(filled)}${"╺".repeat(width - filled)}`;
}

function bytesOf(frames: WireFrame[], s: "o" | "e"): number {
    return frames.filter((f) => f.s === s).reduce((n, f) => n + Buffer.byteLength(f.t), 0);
}

type At = (offsetMs: number) => string;

interface SampleJob {
    seq: number;
    command: string | null;
    state: "exited" | "cancelled" | "lost";
    start: number;
    end: number | null;
    exitCode?: number;
    oom?: boolean;
    peakMib?: number;
    cutBytes?: number;
    frames: WireFrame[];
}

function wireJob(job: SampleJob, at: At, withFrames: boolean): JsonObject {
    const wire: JsonObject = {
        seq: job.seq,
        command: job.command,
        state: job.state,
        startedAt: at(job.start),
    };
    if (job.end !== null) wire.finishedAt = at(job.end);
    if (job.exitCode !== undefined) wire.exitCode = job.exitCode;
    wire.oom = job.oom ?? false;
    wire.peakMib = job.peakMib ?? 0;
    wire.cutBytes = job.cutBytes ?? 0;
    if (withFrames) wire.frames = job.frames;
    return wire;
}

// The exec call, the job's start, and its end unless the provider lost it
function jobEvents(job: SampleJob, at: At): JsonObject[] {
    const events: JsonObject[] = [
        {
            at: at(job.start - 300),
            kind: "mcp",
            tool: "bugnet_exec",
            outcome: "ok",
            durationMs: 280,
        },
        { at: at(job.start), kind: "job", seq: job.seq, phase: "start" },
    ];
    if (job.end === null || job.state === "lost") return events;
    const end: JsonObject = {
        at: at(job.end),
        kind: "job",
        seq: job.seq,
        phase: "end",
        durationMs: job.end - job.start,
        outBytes: bytesOf(job.frames, "o") + (job.cutBytes ?? 0),
        errBytes: bytesOf(job.frames, "e"),
        oom: job.oom ?? false,
        peakMib: job.peakMib ?? 0,
    };
    if (job.exitCode !== undefined) end.exitCode = job.exitCode;
    return [...events, end];
}

/* Events */

interface Package {
    vcpu: number;
    memoryMib: number;
    diskGib: number;
    minutes: number;
}

const devSmall: Package = { vcpu: 2, memoryMib: 2048, diskGib: 10, minutes: 10 };

function placed(at: At, start: number, packageId: string, pkg: Package): JsonObject {
    return {
        at: at(start),
        kind: "placement",
        phase: "placed",
        packageId,
        ...pkg,
        deadline: at(start + pkg.minutes * MIN),
    };
}

function placement(at: At, ms: number, phase: string, extra: JsonObject = {}): JsonObject {
    return { at: at(ms), kind: "placement", phase, ...extra };
}

function payment(at: At, ms: number, payKind: string, amountMicros: number, tx: string) {
    return { at: at(ms), kind: "payment", payKind, amountMicros, tx };
}

function allowance(at: At, ms: number, phase: string, amountMicros: number, tx: string) {
    return {
        at: at(ms),
        kind: "allowance",
        phase,
        amountMicros,
        asset: "USDC",
        network: NETWORK,
        tx,
    };
}

// Unspent money under $0.01 stays with Bugnet, as a row with no transaction (x402 spec 8.4)
function allowanceKept(at: At, ms: number, keptMicros: number) {
    return {
        at: at(ms),
        kind: "allowance",
        phase: "kept",
        amountMicros: 0,
        keptMicros,
        asset: "USDC",
        network: NETWORK,
    };
}

function mcp(at: At, ms: number, tool: string, outcome: string, durationMs: number) {
    return { at: at(ms), kind: "mcp", tool, outcome, durationMs };
}

function file(at: At, ms: number, op: string, path: string, bytes: number) {
    return { at: at(ms), kind: "file", op, path, bytes };
}

function transfer(at: At, ms: number, direction: string, name: string, bytes: number) {
    return { at: at(ms), kind: "transfer", direction, name, bytes };
}

function secretHost(at: At, ms: number, host: string, requests: number, bytes: number) {
    return { at: at(ms), kind: "secret_host", host, requests, bytes };
}

function previewPort(at: At, start: number, port: number, folds: number[]): JsonObject[] {
    return [
        { at: at(start), kind: "preview", port, phase: "issued" },
        ...folds.map((requests, i) => ({
            at: at(start + (i + 1) * MIN),
            kind: "preview",
            port,
            phase: "traffic",
            requests,
            bytes: requests * 4_096,
        })),
        { at: at(start + (folds.length + 1) * MIN), kind: "preview", port, phase: "revoked" },
    ];
}

interface X402Call {
    host: string;
    method: string;
    path: string;
    status: string;
    reason?: string;
    count?: number;
    // The price in the live 402, the amount unless given; 0 when no exact USDC offer came
    askedMicros?: number;
    amountMicros: number;
    resolved?: "paid" | "released" | null;
    tx?: string;
    resent?: true;
    httpStatus?: number;
    durationMs?: number;
    bytesOut?: number;
    bytesIn?: number;
    streamCut?: boolean;
    allowanceLeftMicros?: number;
}

const x402Extras = [
    "httpStatus",
    "durationMs",
    "bytesOut",
    "bytesIn",
    "streamCut",
    "allowanceLeftMicros",
] as const;

// A served x402 row (session-page.md 7.3.1), with its keys in the router's order
function x402(at: At, ms: number, call: X402Call): JsonObject {
    const resolved = call.resolved ?? null;
    if (call.tx !== undefined && resolved !== "paid") {
        throw new Error(`${call.path}: the router serves a tx only on a row resolved as paid`);
    }
    const askedMicros = call.askedMicros ?? call.amountMicros;
    // Asset and network come only with an exact USDC offer on Solana, as the price does
    const offered = askedMicros > 0;
    const event: JsonObject = {
        at: at(ms),
        kind: "x402",
        host: call.host,
        method: call.method,
        path: call.path,
        status: call.status,
        reason: call.reason ?? "",
        count: call.count ?? 1,
        askedMicros,
        amountMicros: call.amountMicros,
        ...(offered ? { asset: "USDC" } : {}),
        network: offered ? NETWORK : "",
    };
    for (const key of x402Extras) {
        const value = call[key];
        if (value !== undefined) event[key] = value;
    }
    event.resolved = resolved;
    if (call.tx !== undefined) event.tx = call.tx;
    if (call.resent) event.resent = true;
    return event;
}

/* Records */

interface RecordSpec {
    v?: number;
    start: number;
    end: number;
    endedBecause: string;
    output: "pending" | "complete" | "partial" | "expired";
    events: JsonObject[];
    eventsDropped?: number;
    jobs: SampleJob[];
}

function wireRecord(spec: RecordSpec, at: At): JsonObject {
    const withFrames = spec.output === "complete" || spec.output === "partial";
    const events = [...spec.events, ...spec.jobs.flatMap((j) => jobEvents(j, at))];
    events.sort((a, b) => Date.parse(String(a.at)) - Date.parse(String(b.at)));
    return {
        v: spec.v ?? 1,
        startedAt: at(spec.start),
        endedAt: at(spec.end),
        endedBecause: spec.endedBecause,
        deletesAt: at(spec.end + 48 * HOUR),
        output: spec.output,
        events,
        eventsDropped: spec.eventsDropped ?? 0,
        jobs: spec.jobs.map((j) => wireJob(j, at, withFrames)),
    };
}

const ended = (record: JsonObject): GetAnswer => ({
    status: 200,
    body: { state: "ended", record },
});

// The start of most sessions, a paid placement that became ready
function opening(at: At, name: ScenarioName, start: number): JsonObject[] {
    return [
        mcp(at, start - 2 * SEC, "bugnet_start", "ok", 38_400),
        placed(at, start, "dev-small-10m", devSmall),
        payment(at, start + SEC, "start", 50_000, sampleTx(`${name}:start`)),
        placement(at, start + 36 * SEC, "ready"),
    ];
}

/* ended-full */

function fullJobs(name: ScenarioName, t0: number): SampleJob[] {
    const progress: WireFrame[] = [out(`  0% ${bar(0)} 0.0/63.6 MB`)];
    for (let p = 5; p <= 100; p += 5) {
        progress.push(
            over(`${String(p).padStart(3)}% ${bar(p)} ${((63.6 * p) / 100).toFixed(1)}/63.6 MB`),
        );
    }
    return [
        {
            seq: 1,
            command: "npm ci --no-audit --no-fund",
            state: "exited",
            start: t0 + 60 * SEC,
            end: t0 + 71 * SEC,
            exitCode: 0,
            peakMib: 310,
            frames: [
                out("\nadded 214 packages in 11s\n"),
                out("\n38 packages are looking for funding\n"),
            ],
        },
        {
            seq: 2,
            command: `npm test -- --grep ${sentinel(name)}`,
            state: "exited",
            start: t0 + 90 * SEC,
            end: t0 + 90 * SEC + 9_200,
            exitCode: 1,
            peakMib: 512,
            frames: [
                out("\n> app@1.0.0 test\n> vitest run\n\n"),
                out(" ✓ src/parse.test.ts (12 tests) 41ms\n"),
                err(" FAIL  src/session.test.ts > reads the record\n"),
                err("AssertionError: expected 'ended' to be 'running'\n"),
                err(" ❯ src/session.test.ts:18:31\n"),
                out("\n Test Files  1 failed | 1 passed (2)\n"),
                out("      Tests  1 failed | 12 passed (13)\n"),
            ],
        },
        {
            seq: 3,
            command: "node --max-old-space-size=4096 scripts/build-index.js",
            state: "exited",
            start: t0 + 2 * MIN,
            end: t0 + 2 * MIN + 41_000,
            exitCode: 137,
            oom: true,
            peakMib: 2048,
            frames: [
                out("Indexing 1204330 documents\n"),
                out("  batch 1 of 12 done\n"),
                out("  batch 2 of 12 done\n"),
                err("\n<--- Last few GCs --->\n"),
                err("FATAL ERROR: Reached heap limit Allocation failed\n"),
            ],
        },
        {
            seq: 4,
            command: "python3 -m http.server 3000",
            state: "cancelled",
            start: t0 + 150 * SEC,
            end: t0 + 5 * MIN,
            peakMib: 24,
            frames: [
                out("Serving HTTP on 0.0.0.0 port 3000 (http://0.0.0.0:3000/) ...\n"),
                err('127.0.0.1 - - [06/Nov/2026 10:03:12] "GET / HTTP/1.1" 200 -\n'),
                err('127.0.0.1 - - [06/Nov/2026 10:03:13] "GET /favicon.ico HTTP/1.1" 404 -\n'),
            ],
        },
        {
            seq: 5,
            command: "tail -f /var/log/app/worker.log",
            state: "lost",
            start: t0 + 5 * MIN + 10 * SEC,
            end: t0 + 12 * MIN,
            frames: [out("worker started pid=412\n"), out("job 1 done\n")],
        },
        {
            seq: 6,
            command: "pip install torch==2.5.1 --progress-bar on",
            state: "exited",
            start: t0 + 6 * MIN,
            end: t0 + 8 * MIN + 10 * SEC,
            exitCode: 0,
            peakMib: 512,
            cutBytes: 1_258_291,
            frames: [
                out("Collecting torch==2.5.1\n"),
                out("  Downloading torch-2.5.1-cp312-none-macosx_11_0_arm64.whl (63.6 MB)\n"),
                ...progress,
                out("\nInstalling collected packages: torch\n"),
                out("Successfully installed torch-2.5.1\n"),
            ],
        },
    ];
}

function endedFull(at: At, name: ScenarioName): JsonObject {
    const t0 = -32 * MIN;
    const end = t0 + 12 * MIN;
    const weather = "weather-api.example";
    const search = "search-api.example";
    const events: JsonObject[] = [
        ...opening(at, name, t0),
        allowance(at, t0 + 2 * SEC, "paid", 50_000, sampleTx(`${name}:allowance`, 87)),
        mcp(at, t0 + 45 * SEC, "bugnet_write_file", "ok", 120),
        file(at, t0 + 45 * SEC, "write", `/workspace/app/${sentinel(name)}.json`, 1_532),
        mcp(at, t0 + 50 * SEC, "bugnet_read_file", "ok", 95),
        file(at, t0 + 50 * SEC, "read", "/workspace/app/package.json", 1_204),
        mcp(at, t0 + 52 * SEC, "bugnet_list_files", "ok", 88),
        file(at, t0 + 52 * SEC, "list", "/workspace/app", 640),
        secretHost(at, t0 + 66 * SEC, "api.github.com", 4, 38_912),
        secretHost(at, t0 + 126 * SEC, "api.github.com", 2, 9_216),
        secretHost(at, t0 + 130 * SEC, "huggingface.co", 3, 14_336),
        x402(at, t0 + 100 * SEC, {
            host: weather,
            method: "GET",
            path: "/v1/forecast",
            status: "paid",
            amountMicros: 3_000,
            resolved: "paid",
            tx: sampleTx(`${name}:x402:1`),
            allowanceLeftMicros: 47_000,
        }),
        x402(at, t0 + 101 * SEC, {
            host: weather,
            method: "GET",
            path: "/v1/forecast",
            status: "paid",
            amountMicros: 3_000,
            resolved: "paid",
            tx: sampleTx(`${name}:x402:2`),
            allowanceLeftMicros: 44_000,
        }),
        x402(at, t0 + 102 * SEC, {
            host: weather,
            method: "GET",
            path: "/v1/alerts",
            status: "free",
            amountMicros: 0,
            allowanceLeftMicros: 44_000,
        }),
        x402(at, t0 + 140 * SEC, {
            host: search,
            method: "POST",
            path: "/v1/search",
            status: "paid",
            amountMicros: 12_000,
            resolved: "paid",
            tx: sampleTx(`${name}:x402:3`),
            allowanceLeftMicros: 32_000,
        }),
        x402(at, t0 + 141 * SEC, {
            host: search,
            method: "POST",
            path: "/v1/search",
            status: "paid",
            amountMicros: 12_000,
            resolved: "paid",
            tx: sampleTx(`${name}:x402:4`, 87),
            allowanceLeftMicros: 20_000,
        }),
        x402(at, t0 + 142 * SEC, {
            host: search,
            method: "POST",
            path: "/v1/search/deep",
            status: "refused_cap",
            reason: "allowance_spent",
            askedMicros: 25_000,
            amountMicros: 0,
            allowanceLeftMicros: 20_000,
        }),
        x402(at, t0 + 143 * SEC, {
            host: search,
            method: "POST",
            path: "/v1/rerank",
            status: "refused_price",
            reason: "price_above_max",
            askedMicros: 40_000,
            amountMicros: 0,
            allowanceLeftMicros: 20_000,
        }),
        x402(at, t0 + 144 * SEC, {
            host: search,
            method: "GET",
            path: "/v1/status",
            status: "upstream_error",
            reason: "upstream_unreachable",
            amountMicros: 0,
            allowanceLeftMicros: 20_000,
        }),
        x402(at, t0 + 200 * SEC, {
            host: "unregistered.example",
            method: "",
            path: "",
            status: "refused_host",
            amountMicros: 0,
        }),
        mcp(at, t0 + 154 * SEC, "bugnet_preview", "ok", 210),
        ...previewPort(at, t0 + 155 * SEC, 3000, [42, 17]),
        mcp(at, t0 + 210 * SEC, "bugnet_transfer", "ok", 1_900),
        transfer(at, t0 + 210 * SEC, "in", "dataset.csv", 2_400_000),
        mcp(at, t0 + 5 * MIN, "bugnet_cancel_job", "ok", 140),
        mcp(at, t0 + 5 * MIN + 30 * SEC, "bugnet_status", "ok", 60),
        mcp(at, t0 + 5 * MIN + 40 * SEC, "bugnet_exec", "timeout", 30_000),
        mcp(at, t0 + 7 * MIN - SEC, "bugnet_ssh", "ok", 400),
        { at: at(t0 + 7 * MIN), kind: "ssh", phase: "start" },
        { at: at(t0 + 9 * MIN), kind: "ssh", phase: "end", bytesIn: 18_432, bytesOut: 402_113 },
        mcp(at, t0 + 8 * MIN - SEC, "bugnet_extend", "ok", 2_100),
        placement(at, t0 + 8 * MIN, "extended", { minutes: 5, deadline: at(t0 + 15 * MIN) }),
        payment(at, t0 + 8 * MIN + SEC, "extend", 25_000, sampleTx(`${name}:extend`, 86)),
        mcp(at, t0 + 11 * MIN, "bugnet_transfer", "ok", 900),
        transfer(at, t0 + 11 * MIN, "out", `${sentinel(name)}-report.zip`, 812_000),
        mcp(at, end - 2 * SEC, "bugnet_stop", "ok", 1_800),
        placement(at, end, "ended", { endedBecause: "stopped" }),
        allowance(at, end + 30 * SEC, "refunded", 20_000, sampleTx(`${name}:refund`)),
    ];
    return wireRecord(
        {
            start: t0,
            end,
            endedBecause: "stopped",
            output: "complete",
            events,
            jobs: fullJobs(name, t0),
        },
        at,
    );
}

/* Smaller ended sessions */

function basicJobs(name: ScenarioName, t0: number, cutBytes = 0): SampleJob[] {
    return [
        {
            seq: 1,
            command: `npm ci --prefix ${sentinel(name)}`,
            state: "exited",
            start: t0 + 50 * SEC,
            end: t0 + 62 * SEC,
            exitCode: 0,
            peakMib: 280,
            frames: [out("\nadded 96 packages in 12s\n")],
        },
        {
            seq: 2,
            command: "npm run build",
            state: "exited",
            start: t0 + 70 * SEC,
            end: t0 + 74_300,
            exitCode: 0,
            peakMib: 640,
            cutBytes,
            frames: [
                out("\n> app@1.0.0 build\n> vite build\n\n"),
                err("(!) Some chunks are larger than 500 kB after minification.\n"),
                out("✓ built in 4.12s\n"),
            ],
        },
    ];
}

function basicRecord(
    at: At,
    name: ScenarioName,
    spec: { endedBecause: string; output: RecordSpec["output"]; v?: number; cutBytes?: number },
): JsonObject {
    const t0 = -14 * MIN;
    const end = t0 + 10 * MIN;
    const events = [
        ...opening(at, name, t0),
        mcp(at, t0 + 40 * SEC, "bugnet_write_file", "ok", 110),
        file(at, t0 + 40 * SEC, "write", `/workspace/${sentinel(name)}/notes.md`, 418),
        placement(at, end, "ended", { endedBecause: spec.endedBecause }),
    ];
    const jobs = basicJobs(name, t0, spec.cutBytes);
    return wireRecord({ ...spec, start: t0, end, events, jobs }, at);
}

function endedEmpty(at: At, name: ScenarioName): JsonObject {
    const t0 = -9 * MIN;
    const end = t0 + 4 * MIN;
    const events = [
        placed(at, t0, sentinel(name), devSmall),
        placement(at, t0 + 40 * SEC, "ready"),
        placement(at, end, "ended", { endedBecause: "stopped" }),
    ];
    return wireRecord(
        { start: t0, end, endedBecause: "stopped", output: "complete", events, jobs: [] },
        at,
    );
}

/* ended-crowded */

function endedCrowded(at: At, name: ScenarioName): JsonObject {
    const t0 = -40 * MIN;
    const end = t0 + 30 * MIN;
    const secretHosts: [string, number][] = [
        ["api.github.com", 40],
        ["huggingface.co", 33],
        ["api.openai.com", 27],
        ["api.anthropic.com", 21],
        ["registry.npmjs.org", 18],
        ["api.stripe.com", 15],
        ["hooks.slack.com", 12],
        ["api.sendgrid.com", 9],
        ["s3.eu-west-1.amazonaws.com", 7],
        ["api.cloudflare.com", 5],
        [`vault.${sentinel(name)}.example`, 3],
        ["sentry.io", 1],
    ];
    const x402Hosts: [string, number][] = [
        ["geo.x402.example", 14],
        ["news.x402.example", 11],
        ["fx-rates.x402.example", 8],
        ["translate.x402.example", 6],
        ["ocr.x402.example", 4],
        ["maps.x402.example", 3],
        ["stocks.x402.example", 2],
        ["weather.x402.example", 2],
        ["tts.x402.example", 1],
    ];
    let left = 1_000_000;
    const events: JsonObject[] = [
        ...opening(at, name, t0),
        allowance(at, t0 + 2 * SEC, "paid", 1_000_000, sampleTx(`${name}:allowance`)),
        ...secretHosts.flatMap(([host, requests], i) => {
            const first = Math.ceil(requests / 2);
            const rows = [secretHost(at, t0 + (2 + i) * MIN, host, first, first * 2_048)];
            if (requests > first) {
                const rest = requests - first;
                rows.push(secretHost(at, t0 + (3 + i) * MIN, host, rest, rest * 2_048));
            }
            return rows;
        }),
        ...x402Hosts.flatMap(([host, calls], h) =>
            Array.from({ length: calls }, (_, i) => {
                const refused = i === calls - 1 && calls > 3;
                const amountMicros = refused ? 0 : 2_000 + h * 500;
                left -= amountMicros;
                return x402(at, t0 + (5 + h) * MIN + i * SEC, {
                    host,
                    method: "GET",
                    path: `/v1/${host.split(".")[0]}`,
                    amountMicros,
                    allowanceLeftMicros: left,
                    ...(refused
                        ? {
                              status: "refused_price",
                              reason: "price_above_max",
                              askedMicros: 50_000,
                          }
                        : {
                              status: "paid",
                              resolved: "paid" as const,
                              tx: sampleTx(`${name}:x402:${h}:${i}`),
                          }),
                });
            }),
        ),
        ...[3000, 3001, 4173, 5173, 8000, 8080, 9229].flatMap((port, i) =>
            previewPort(at, t0 + (4 + i) * MIN, port, [30 - i * 3, 12 - i]),
        ),
        placement(at, end, "ended", { endedBecause: "deadline" }),
        allowance(at, end + 20 * SEC, "refunded", left, sampleTx(`${name}:refund`)),
    ];
    return wireRecord(
        {
            start: t0,
            end,
            endedBecause: "deadline",
            output: "complete",
            events,
            eventsDropped: 120,
            jobs: basicJobs(name, t0),
        },
        at,
    );
}

/* ended-hostile */

const markup = "<img src=x onerror=alert(1)>";

function endedHostile(at: At, name: ScenarioName): JsonObject {
    const t0 = -25 * MIN;
    const end = t0 + 10 * MIN;
    const longHost = `secure-bugnet-wallet-recovery-1.${sentinel(name)}.example`;
    const longLine = `${`{"data":"${"A1b2C3d4".repeat(2_500)}`.slice(0, 19_998)}"}`;
    const flood: WireFrame[] = [];
    for (let from = 1; from <= 6_000; from += 500) {
        const lines = Array.from({ length: 500 }, (_, i) => `${from + i}\n`);
        flood.push(out(lines.join("")));
    }
    const jobs: SampleJob[] = [
        {
            seq: 1,
            command: `echo '${markup}' # ${sentinel(name)}`,
            state: "exited",
            start: t0 + MIN,
            end: t0 + MIN + 40,
            exitCode: 0,
            frames: [out(`${markup}\n`)],
        },
        {
            seq: 2,
            command: "cat notice.txt",
            state: "exited",
            start: t0 + 2 * MIN,
            end: t0 + 2 * MIN + 30,
            exitCode: 0,
            frames: [
                out("Bugnet: your wallet is at risk. Pay 25 USDC at "),
                out("https://bugnet-wallet-recovery.example/restore within 10 minutes.\n"),
                out('Bugnet support: <a href="https://evil.example">verify your keys</a>\n'),
                out(
                    "\u001b[31mRED ALERT\u001b[0m \u001b]8;;https://evil.example\u0007link\u001b]8;;\u0007\n",
                ),
                out("invoice.\u202Efdp.exe\n"),
                err(`${markup}\n`),
            ],
        },
        {
            seq: 3,
            command: 'node -e "process.stdout.write(JSON.stringify(big))"',
            state: "exited",
            start: t0 + 3 * MIN,
            end: t0 + 3 * MIN + 900,
            exitCode: 0,
            frames: [out(`${longLine}\n`)],
        },
        {
            seq: 4,
            command: "seq 1 6000",
            state: "exited",
            start: t0 + 4 * MIN,
            end: t0 + 4 * MIN + 1_200,
            exitCode: 0,
            frames: flood,
        },
    ];
    const events = [
        mcp(at, t0 - 2 * SEC, "bugnet_start", "ok", 38_400),
        placed(at, t0, "dev-small-10m", devSmall),
        payment(at, t0 + SEC, "start", 50_000, "javascript:alert(document.cookie)"),
        placement(at, t0 + 36 * SEC, "ready"),
        allowance(at, t0 + 2 * SEC, "paid", 50_000, sampleTx(`${name}:allowance`)),
        secretHost(at, t0 + 3 * MIN, markup, 3, 1_024),
        x402(at, t0 + 4 * MIN, {
            host: longHost,
            method: "POST",
            path: `/pay/${markup}`,
            status: "paid",
            amountMicros: 25_000,
            resolved: "paid",
            tx: "0OIl".repeat(22),
            allowanceLeftMicros: 25_000,
        }),
        mcp(at, t0 + 5 * MIN, "bugnet_write_file", "ok", 90),
        file(at, t0 + 5 * MIN, "write", "/tmp/<script>alert(1)</script>.sh", 64),
        placement(at, end, "ended", { endedBecause: "stopped" }),
    ];
    return wireRecord(
        { start: t0, end, endedBecause: "stopped", output: "complete", events, jobs },
        at,
    );
}

/* x402 sessions */

// An x402 session ended by bugnet_stop: the opening, a file and two jobs carry the sentinel
function x402Record(at: At, name: ScenarioName, t0: number, events: JsonObject[]): JsonObject {
    const end = t0 + 10 * MIN;
    return wireRecord(
        {
            start: t0,
            end,
            endedBecause: "stopped",
            output: "complete",
            events: [
                ...opening(at, name, t0),
                mcp(at, t0 + 40 * SEC, "bugnet_write_file", "ok", 110),
                file(at, t0 + 40 * SEC, "write", `/workspace/${sentinel(name)}/notes.md`, 418),
                ...events,
                placement(at, end, "ended", { endedBecause: "stopped" }),
            ],
            jobs: basicJobs(name, t0),
        },
        at,
    );
}

// Every kind of row the router serves, from x402 spec 8.2, 8.3 and 8.5
function endedX402(at: At, name: ScenarioName): JsonObject {
    const t0 = -20 * MIN;
    const end = t0 + 10 * MIN;
    const search = "search-api.example";
    const weather = "weather-api.example";
    const data = "data-api.example";
    const call = (s: number, c: X402Call) => x402(at, t0 + s * SEC, c);
    const refusedHost = (s: number, host: string, count: number) =>
        call(s, { host, method: "", path: "", status: "refused_host", count, amountMicros: 0 });
    const events = [
        allowance(at, t0 + 2 * SEC, "paid", 100_000, sampleTx(`${name}:allowance`)),
        call(100, {
            host: search,
            method: "POST",
            path: "/v1/search",
            status: "paid",
            amountMicros: 12_000,
            resolved: "paid",
            tx: sampleTx(`${name}:x402:search`),
            httpStatus: 200,
            durationMs: 1_840,
            bytesOut: 412,
            bytesIn: 18_204,
            streamCut: false,
            allowanceLeftMicros: 88_000,
        }),
        // A resend of the same payment: the router keeps the money on the first row only
        call(110, {
            host: weather,
            method: "GET",
            path: "/v1/forecast",
            status: "paid",
            amountMicros: 3_000,
            resolved: "paid",
            tx: sampleTx(`${name}:x402:forecast`, 87),
            httpStatus: 200,
            durationMs: 920,
            allowanceLeftMicros: 85_000,
        }),
        call(111, {
            host: weather,
            method: "GET",
            path: "/v1/forecast",
            status: "paid",
            askedMicros: 3_000,
            amountMicros: 0,
            resolved: "paid",
            resent: true,
            httpStatus: 200,
            durationMs: 610,
            allowanceLeftMicros: 85_000,
        }),
        // The seller says paid, but only Payments' word makes it so
        call(130, {
            host: data,
            method: "POST",
            path: "/v1/query",
            status: "paid",
            amountMicros: 5_000,
            httpStatus: 200,
            durationMs: 2_310,
            allowanceLeftMicros: 80_000,
        }),
        call(140, {
            host: data,
            method: "POST",
            path: "/v1/export",
            status: "payment_failed",
            reason: "payment_rejected",
            amountMicros: 4_000,
            resolved: "released",
            httpStatus: 402,
            durationMs: 1_150,
            allowanceLeftMicros: 80_000,
        }),
        call(150, {
            host: search,
            method: "POST",
            path: "/v1/summarize",
            status: "uncertain",
            reason: "paid_no_answer",
            amountMicros: 2_000,
            durationMs: 30_000,
            allowanceLeftMicros: 78_000,
        }),
        call(160, {
            host: weather,
            method: "GET",
            path: "/v1/alerts",
            status: "free",
            amountMicros: 0,
        }),
        call(220, {
            host: weather,
            method: "GET",
            path: "/v1/alerts",
            status: "free",
            count: 12,
            amountMicros: 0,
            bytesIn: 49_152,
        }),
        call(170, {
            host: search,
            method: "POST",
            path: "/v1/search/deep",
            status: "refused_cap",
            reason: "allowance_spent",
            askedMicros: 90_000,
            amountMicros: 0,
        }),
        call(230, {
            host: search,
            method: "POST",
            path: "/v1/search/deep",
            status: "refused_cap",
            reason: "allowance_spent",
            count: 40,
            askedMicros: 90_000,
            amountMicros: 0,
        }),
        call(175, {
            host: search,
            method: "POST",
            path: "/v1/rerank",
            status: "refused_price",
            reason: "price_above_max",
            askedMicros: 50_000,
            amountMicros: 0,
        }),
        call(180, {
            host: data,
            method: "POST",
            path: "/v1/upload",
            status: "refused_request",
            reason: "body_too_large",
            amountMicros: 0,
        }),
        call(185, {
            host: weather,
            method: "GET",
            path: "/v1/history",
            status: "refused_payee",
            reason: "payee_changed",
            askedMicros: 3_000,
            amountMicros: 0,
        }),
        call(190, {
            host: data,
            method: "GET",
            path: "/v1/stream",
            status: "refused_network",
            reason: "network_unsupported",
            amountMicros: 0,
        }),
        call(195, {
            host: data,
            method: "POST",
            path: "/v1/batch",
            status: "refused_terms",
            reason: "splits_unsupported",
            amountMicros: 0,
        }),
        call(200, {
            host: weather,
            method: "GET",
            path: "/v1/radar",
            status: "not_paid",
            reason: "payments_unavailable",
            askedMicros: 3_000,
            amountMicros: 0,
        }),
        call(205, {
            host: search,
            method: "GET",
            path: "/v1/status",
            status: "upstream_error",
            reason: "upstream_unreachable",
            amountMicros: 0,
        }),
        refusedHost(240, "pay.unknown-seller.example", 1),
        refusedHost(245, "mirror.example", 3),
        refusedHost(250, `${sentinel(name)}.example`, 1),
        // Names past the per-minute limit, and any name that was not clean, share one empty row
        refusedHost(260, "", 17),
        call(265, {
            host: data,
            method: "GET",
            path: "/v1/report",
            status: "self_paid",
            amountMicros: 0,
            httpStatus: 200,
        }),
        allowance(at, end + 30 * SEC, "refunded", 78_000, sampleTx(`${name}:refund`)),
    ];
    return x402Record(at, name, t0, events);
}

// Ended two minutes ago with two payments settling; the next answer has them resolved
function endedX402Settling(at: At, name: ScenarioName, settled: boolean): JsonObject {
    const t0 = -12 * MIN;
    const end = t0 + 10 * MIN;
    const search = "search-api.example";
    const data = "data-api.example";
    const events = [
        allowance(at, t0 + 2 * SEC, "paid", 50_000, sampleTx(`${name}:allowance`)),
        x402(at, t0 + 100 * SEC, {
            host: search,
            method: "POST",
            path: "/v1/search",
            status: "paid",
            amountMicros: 12_000,
            resolved: "paid",
            tx: sampleTx(`${name}:x402:1`),
            allowanceLeftMicros: 38_000,
        }),
        x402(at, t0 + 120 * SEC, {
            host: search,
            method: "POST",
            path: "/v1/search/deep",
            status: "paid",
            amountMicros: 12_000,
            ...(settled ? { resolved: "paid", tx: sampleTx(`${name}:x402:2`, 86) } : {}),
            allowanceLeftMicros: 26_000,
        }),
        x402(at, t0 + 140 * SEC, {
            host: data,
            method: "POST",
            path: "/v1/query",
            status: "uncertain",
            reason: "paid_no_answer",
            amountMicros: 5_000,
            ...(settled ? { resolved: "released" } : {}),
            allowanceLeftMicros: 21_000,
        }),
        // Payments refunds once nothing settles, the released 0.005 included
        ...(settled
            ? [allowance(at, end + 60 * SEC, "refunded", 26_000, sampleTx(`${name}:refund`))]
            : []),
    ];
    return x402Record(at, name, t0, events);
}

// 0.004 USDC left over is under the $0.01 refund minimum, so Bugnet keeps it
function endedX402Kept(at: At, name: ScenarioName): JsonObject {
    const t0 = -30 * MIN;
    const end = t0 + 10 * MIN;
    const paid = (s: number, host: string, amountMicros: number, left: number) =>
        x402(at, t0 + s * SEC, {
            host,
            method: "GET",
            path: "/v1/lookup",
            status: "paid",
            amountMicros,
            resolved: "paid",
            tx: sampleTx(`${name}:x402:${s}`),
            allowanceLeftMicros: left,
        });
    const events = [
        allowance(at, t0 + 2 * SEC, "paid", 50_000, sampleTx(`${name}:allowance`)),
        paid(100, "search-api.example", 12_000, 38_000),
        paid(110, "search-api.example", 12_000, 26_000),
        paid(120, "search-api.example", 12_000, 14_000),
        paid(130, "weather-api.example", 5_000, 9_000),
        paid(140, "weather-api.example", 5_000, 4_000),
        allowanceKept(at, end + 30 * SEC, 4_000),
    ];
    return x402Record(at, name, t0, events);
}

// Closed and settled, but the refund came 0.01 USDC short of what was left
function endedX402Reconcile(at: At, name: ScenarioName): JsonObject {
    const t0 = -50 * MIN;
    const end = t0 + 10 * MIN;
    const events = [
        allowance(at, t0 + 2 * SEC, "paid", 100_000, sampleTx(`${name}:allowance`)),
        x402(at, t0 + 100 * SEC, {
            host: "search-api.example",
            method: "POST",
            path: "/v1/search",
            status: "paid",
            amountMicros: 20_000,
            resolved: "paid",
            tx: sampleTx(`${name}:x402:1`),
            allowanceLeftMicros: 80_000,
        }),
        allowance(at, end + 30 * SEC, "refunded", 70_000, sampleTx(`${name}:refund`)),
    ];
    return x402Record(at, name, t0, events);
}

/* running */

function runningScenario(
    at: At,
    name: ScenarioName,
): { body: JsonObject; live: Record<number, LiveScript> } {
    const clone: WireFrame[] = [err(`Cloning into '${sentinel(name)}'...\n`)];
    for (let p = 10; p <= 100; p += 10) {
        clone.push(over(`Receiving objects: ${String(p).padStart(3)}% (${p * 12}/1200)`, "e"));
    }
    clone.push(err(", done.\n"));
    const lint = [
        out("\n> app@1.0.0 lint\n> eslint .\n\n"),
        out("/workspace/app/src/main.ts\n"),
        err("  12:7  error  'unused' is assigned a value but never used  no-unused-vars\n"),
        out("\n✖ 1 problem (1 error, 0 warnings)\n"),
    ];
    const build: WireFrame[] = [out("\n> app@1.0.0 build\n> vite build --watch\n\n")];
    for (let i = 1; i <= 30; i++) build.push(out(`transforming (${i * 7}) src/module-${i}.ts\n`));
    build.push(out(`rendering chunks ${bar(0)}`));
    for (let p = 1; p <= 100; p++) build.push(over(`rendering chunks ${bar(p)} ${p}%`));
    build.push(out("\n✓ built in 4.20s\n"), out("watching for file changes...\n"));
    for (let i = 1; i <= 30; i++) {
        build.push(out(`[watch] rebuilt src/module-${i}.ts in ${90 + i}ms\n`));
    }
    const tests: WireFrame[] = [out("\n RUN  v5.1.0 /workspace/app\n\n")];
    for (let i = 1; i <= 160; i++) {
        tests.push(
            i % 7 === 0
                ? err(` ✗ suite ${i} retried once\n`)
                : out(` ✓ suite ${i} (${i % 13} tests)\n`),
        );
    }
    const jobs = [
        {
            seq: 1,
            command: `git clone --depth 1 https://example.com/${sentinel(name)}.git`,
            start: -170 * SEC,
            end: -165 * SEC,
            exit: { exitCode: 0, oom: false, peakMib: 40 },
            frames: clone,
        },
        {
            seq: 2,
            command: "npm run lint",
            start: -150 * SEC,
            end: -141 * SEC,
            exit: { exitCode: 1, oom: false, peakMib: 180 },
            frames: lint,
        },
        {
            seq: 3,
            command: "npm run build -- --watch",
            start: -60 * SEC,
            end: null,
            exit: null,
            frames: build,
        },
        {
            seq: 4,
            command: "npm test -- --watch",
            start: -30 * SEC,
            end: null,
            exit: null,
            frames: tests,
        },
    ];
    const snapshot: JsonObject = {
        v: 1,
        startedAt: at(-3 * MIN),
        deadline: at(7 * MIN),
        now: at(0),
        jobs: jobs.map((j) => {
            const wire: JsonObject = {
                seq: j.seq,
                command: j.command,
                state: j.exit === null ? "running" : "exited",
                startedAt: at(j.start),
                outBytes: bytesOf(j.frames, "o"),
                errBytes: bytesOf(j.frames, "e"),
            };
            if (j.end !== null && j.exit !== null) {
                Object.assign(wire, { finishedAt: at(j.end), ...j.exit });
            }
            return wire;
        }),
    };
    const live: Record<number, LiveScript> = {};
    for (const j of jobs) live[j.seq] = { frames: j.frames, exit: j.exit };
    return { body: { state: "running", snapshot }, live };
}

/* Scenarios */

export function makeScenarios(now: Date): Record<ScenarioName, Scenario> {
    const base = now.getTime();
    const at: At = (offsetMs) => new Date(base + offsetMs).toISOString();
    const make = (
        kind: ScenarioName,
        gets: GetAnswer[],
        live: Record<number, LiveScript> = {},
    ) => ({
        id: sampleId(kind),
        key: sampleKey(kind),
        kind,
        gets,
        live,
    });
    const running = runningScenario(at, "running");
    const pending = (output: RecordSpec["output"]) =>
        ended(basicRecord(at, "ended-pending", { endedBecause: "deadline", output }));
    return {
        "ended-full": make("ended-full", [ended(endedFull(at, "ended-full"))]),
        "ended-pending": make("ended-pending", [
            pending("pending"),
            pending("pending"),
            pending("complete"),
        ]),
        "ended-output-expired": make("ended-output-expired", [
            ended(
                basicRecord(at, "ended-output-expired", {
                    endedBecause: "exited",
                    output: "expired",
                }),
            ),
        ]),
        "ended-partial": make("ended-partial", [
            ended(
                basicRecord(at, "ended-partial", {
                    endedBecause: "fault",
                    output: "partial",
                    cutBytes: 65_536,
                }),
            ),
        ]),
        "ended-empty": make("ended-empty", [ended(endedEmpty(at, "ended-empty"))]),
        "ended-crowded": make("ended-crowded", [ended(endedCrowded(at, "ended-crowded"))]),
        "ended-hostile": make("ended-hostile", [ended(endedHostile(at, "ended-hostile"))]),
        "ended-x402": make("ended-x402", [ended(endedX402(at, "ended-x402"))]),
        "ended-x402-settling": make("ended-x402-settling", [
            ended(endedX402Settling(at, "ended-x402-settling", false)),
            ended(endedX402Settling(at, "ended-x402-settling", true)),
        ]),
        "ended-x402-kept": make("ended-x402-kept", [ended(endedX402Kept(at, "ended-x402-kept"))]),
        "ended-x402-reconcile": make("ended-x402-reconcile", [
            ended(endedX402Reconcile(at, "ended-x402-reconcile")),
        ]),
        running: make("running", [{ status: 200, body: running.body }], running.live),
        expired: make("expired", [{ status: 200, body: { state: "expired" } }]),
        "too-new": make("too-new", [
            ended(
                basicRecord(at, "too-new", { endedBecause: "deadline", output: "complete", v: 2 }),
            ),
        ]),
        "rate-limited": make("rate-limited", [{ status: 429, body: null }]),
        deletable: make("deletable", [
            ended(basicRecord(at, "deletable", { endedBecause: "stopped", output: "complete" })),
        ]),
    };
}

/* The dist check */

function collect(value: Json, into: Set<string>): void {
    if (Array.isArray(value)) {
        for (const item of value) collect(item, into);
        return;
    }
    if (value === null || typeof value !== "object") return;
    for (const key of ["command", "host"]) {
        const text = value[key];
        if (typeof text === "string") into.add(text);
    }
    if (value.kind === "file" && typeof value.path === "string") into.add(value.path);
    if (value.kind === "transfer" && typeof value.name === "string") into.add(value.name);
    for (const item of Object.values(value)) collect(item, into);
}

// Short strings such as "ls" would match minified code by chance, so only 12 characters or more
export function sampleStrings(scenarios: Record<ScenarioName, Scenario>): string[] {
    const found = new Set<string>();
    for (const s of Object.values(scenarios)) {
        found.add(sentinel(s.kind));
        found.add(s.id);
        found.add(s.key);
        for (const answer of s.gets) collect(answer.body, found);
    }
    return [...found].filter((s) => s.length >= 12);
}
