/**
 * Reads the 200 body of POST /v1/s/<id> (session-page.md 7.2 and 7.3.1).
 *
 * The body wraps one payload: {"state":"ended","record":…}, {"state":"running","snapshot":…} or
 * {"state":"expired"}. A payload whose `v` is not 1, or a state this page does not know, comes
 * back as "too-new", so an old page asks for a reload instead of guessing.
 *
 * Events are dropped one by one when their kind is unknown or a field is malformed, so the router
 * can add kinds. Anything else malformed throws PayloadError, since the page cannot show a record
 * whose times or jobs it cannot trust.
 */

export type Stream = "o" | "e";
export interface Frame {
    s: Stream;
    t: string;
    cr: boolean;
}

export type JobState = "running" | "exited" | "cancelled" | "lost";
export interface Job {
    seq: number;
    command: string | null;
    state: JobState;
    startedAt: Date;
    finishedAt: Date | null;
    exitCode: number | null;
    oom: boolean;
    peakMib: number;
    outBytes: number | null;
    errBytes: number | null;
    cutBytes: number;
    frames: Frame[] | null;
}

export type OutputState = "pending" | "complete" | "partial" | "expired";
export type EndedBecause = "stopped" | "deadline" | "failed" | "exited" | "fault" | "other";

export interface SessionRecord {
    startedAt: Date;
    endedAt: Date;
    endedBecause: EndedBecause;
    deletesAt: Date;
    output: OutputState;
    events: SessionEvent[];
    eventsDropped: number;
    jobs: Job[];
    // Commands past the router's per-session cap, which have no row
    jobsDropped: number;
}

export interface Snapshot {
    startedAt: Date;
    deadline: Date;
    now: Date;
    jobs: Job[];
    jobsDropped: number;
}

export interface PlacementEvent {
    at: Date;
    kind: "placement";
    phase: "placed" | "ready" | "extended" | "ended";
    packageId?: string;
    vcpu?: number;
    memoryMib?: number;
    diskGib?: number;
    minutes?: number;
    deadline?: Date;
    endedBecause?: EndedBecause;
}

export interface PaymentEvent {
    at: Date;
    kind: "payment";
    payKind: "start" | "extend";
    amountMicros: number;
    tx: string;
}

export interface JobEvent {
    at: Date;
    kind: "job";
    seq: number;
    phase: "start" | "end";
    exitCode?: number;
    durationMs?: number;
    outBytes?: number;
    errBytes?: number;
    oom?: boolean;
    peakMib?: number;
}

export interface FileEvent {
    at: Date;
    kind: "file";
    op: "read" | "write" | "list";
    path: string;
    bytes: number;
}

export interface PreviewEvent {
    at: Date;
    kind: "preview";
    port: number;
    phase: "issued" | "revoked" | "traffic";
    requests?: number;
    bytes?: number;
}

export interface TransferEvent {
    at: Date;
    kind: "transfer";
    direction: "in" | "out";
    name: string;
    bytes: number;
}

export interface SshEvent {
    at: Date;
    kind: "ssh";
    phase: "start" | "end";
    bytesIn?: number;
    bytesOut?: number;
}

export interface SecretHostEvent {
    at: Date;
    kind: "secret_host";
    host: string;
    requests: number;
    bytes: number;
}

export interface McpEvent {
    at: Date;
    kind: "mcp";
    tool: string;
    outcome: string;
    durationMs: number;
}

// x402 spec 8.2
export type X402Status =
    | "paid"
    | "uncertain"
    | "payment_failed"
    | "free"
    | "self_paid"
    | "refused_cap"
    | "refused_price"
    | "refused_payee"
    | "refused_network"
    | "refused_terms"
    | "refused_request"
    | "refused_host"
    | "not_paid"
    | "upstream_error";

/**
 * One served x402 row (x402 spec 8.1 and 8.3). The router has already joined the payment's
 * resolution in and served one payment's money on one row only, so the page never joins rows.
 * `host`, `method`, `path` and `reason` may be empty, as on the overflow `refused_host` row.
 */
export interface X402Event {
    at: Date;
    kind: "x402";
    host: string;
    method: string;
    path: string;
    // Kept as its raw word when unknown, since newer statuses may still have paid
    status: X402Status | (string & {});
    reason: string;
    // The calls in this row, more than 1 on a folded one
    count: number;
    askedMicros: number;
    amountMicros: number;
    asset?: string;
    network: string;
    httpStatus?: number;
    durationMs?: number;
    bytesOut?: number;
    bytesIn?: number;
    streamCut?: boolean;
    allowanceLeftMicros?: number;
    // null while the payment settles; the seller's word in `status` never makes it paid
    resolved: "paid" | "released" | null;
    tx?: string;
    resent: boolean;
}

export interface AllowanceEvent {
    at: Date;
    kind: "allowance";
    phase: "paid" | "refunded" | "kept";
    amountMicros: number;
    keptMicros?: number;
    // Left out for any mint other than USDC, since a base58 key could be a wallet's address
    asset?: string;
    network: string;
    tx?: string;
}

export type SessionEvent =
    | PlacementEvent
    | PaymentEvent
    | JobEvent
    | FileEvent
    | PreviewEvent
    | TransferEvent
    | SshEvent
    | SecretHostEvent
    | McpEvent
    | X402Event
    | AllowanceEvent;

export type GetBody =
    | { state: "ended"; record: SessionRecord }
    | { state: "running"; snapshot: Snapshot }
    | { state: "expired" }
    | { state: "too-new" };

export class PayloadError extends Error {}

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const SIGNATURE_BYTES = 64;

// Decoded, never measured, since a valid signature can be 86 characters (7.3.1)
export function isSignature(tx: string): boolean {
    // Each leading "1" stands for one zero byte
    let zeros = 0;
    while (tx[zeros] === "1") zeros++;
    const width = SIGNATURE_BYTES - zeros;
    if (width < 0) return false;
    const limit = 1n << BigInt(8 * width);
    let n = 0n;
    for (let i = zeros; i < tx.length; i++) {
        const digit = BASE58.indexOf(tx.charAt(i));
        if (digit < 0) return false;
        n = n * 58n + BigInt(digit);
        // Stops a hostile 20,000-character string within a few dozen digits
        if (n >= limit) return false;
    }
    // The rest fills its bytes exactly, so its top byte is not zero
    return n >= limit >> 8n;
}

/* Field readers */

type Doc = Record<string, unknown>;
type Check<T> = (v: unknown) => v is T;

function isDoc(v: unknown): v is Doc {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isText(v: unknown): v is string {
    return typeof v === "string";
}

function isFlag(v: unknown): v is boolean {
    return typeof v === "boolean";
}

function isInt(v: unknown): v is number {
    return Number.isSafeInteger(v);
}

function isCount(v: unknown): v is number {
    return isInt(v) && v >= 0;
}

function isAmount(v: unknown): v is number {
    return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

function isSeq(v: unknown): v is number {
    return isInt(v) && v >= 1;
}

function isPort(v: unknown): v is number {
    return isInt(v) && v >= 1 && v <= 65_535;
}

function isList(v: unknown): v is unknown[] {
    return Array.isArray(v);
}

function oneOf<const T extends string>(...values: T[]): Check<T> {
    return (v): v is T => typeof v === "string" && (values as string[]).includes(v);
}

const RFC3339_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/i;

function isTime(v: unknown): v is string {
    return isText(v) && RFC3339_RE.test(v) && !Number.isNaN(Date.parse(v));
}

function need<T>(doc: Doc, key: string, ok: Check<T>): T {
    const v = doc[key];
    if (!ok(v)) throw new PayloadError(`${key} is missing or malformed`);
    return v;
}

function maybe<T>(doc: Doc, key: string, ok: Check<T>): T | undefined {
    const v = doc[key];
    if (v === undefined || v === null) return undefined;
    if (!ok(v)) throw new PayloadError(`${key} is malformed`);
    return v;
}

function time(doc: Doc, key: string): Date {
    return new Date(need(doc, key, isTime));
}

function maybeTime(doc: Doc, key: string): Date | undefined {
    const v = maybe(doc, key, isTime);
    return v === undefined ? undefined : new Date(v);
}

// An optional field the wire left out stays out, rather than present as undefined
function compact<T extends object>(o: T): T {
    for (const key of Object.keys(o) as (keyof T)[]) if (o[key] === undefined) delete o[key];
    return o;
}

/* Events */

const endedReasons: readonly string[] = ["stopped", "deadline", "failed", "exited", "fault"];

function endedBecause(v: unknown): EndedBecause {
    return typeof v === "string" && endedReasons.includes(v) ? (v as EndedBecause) : "other";
}

const eventReaders = new Map<string, (d: Doc, at: Date) => SessionEvent>([
    [
        "placement",
        (d, at) => ({
            at,
            kind: "placement",
            phase: need(d, "phase", oneOf("placed", "ready", "extended", "ended")),
            packageId: maybe(d, "packageId", isText),
            vcpu: maybe(d, "vcpu", isAmount),
            memoryMib: maybe(d, "memoryMib", isAmount),
            diskGib: maybe(d, "diskGib", isAmount),
            minutes: maybe(d, "minutes", isAmount),
            deadline: maybeTime(d, "deadline"),
            endedBecause: d.endedBecause === undefined ? undefined : endedBecause(d.endedBecause),
        }),
    ],
    [
        "payment",
        (d, at) => ({
            at,
            kind: "payment",
            payKind: need(d, "payKind", oneOf("start", "extend")),
            amountMicros: need(d, "amountMicros", isCount),
            tx: need(d, "tx", isText),
        }),
    ],
    [
        "job",
        (d, at) => ({
            at,
            kind: "job",
            seq: need(d, "seq", isSeq),
            phase: need(d, "phase", oneOf("start", "end")),
            exitCode: maybe(d, "exitCode", isInt),
            durationMs: maybe(d, "durationMs", isAmount),
            outBytes: maybe(d, "outBytes", isCount),
            errBytes: maybe(d, "errBytes", isCount),
            oom: maybe(d, "oom", isFlag),
            peakMib: maybe(d, "peakMib", isAmount),
        }),
    ],
    [
        "file",
        (d, at) => ({
            at,
            kind: "file",
            op: need(d, "op", oneOf("read", "write", "list")),
            path: need(d, "path", isText),
            bytes: need(d, "bytes", isCount),
        }),
    ],
    [
        "preview",
        (d, at) => ({
            at,
            kind: "preview",
            port: need(d, "port", isPort),
            phase: need(d, "phase", oneOf("issued", "revoked", "traffic")),
            requests: maybe(d, "requests", isCount),
            bytes: maybe(d, "bytes", isCount),
        }),
    ],
    [
        "transfer",
        (d, at) => ({
            at,
            kind: "transfer",
            direction: need(d, "direction", oneOf("in", "out")),
            name: need(d, "name", isText),
            bytes: need(d, "bytes", isCount),
        }),
    ],
    [
        "ssh",
        (d, at) => ({
            at,
            kind: "ssh",
            phase: need(d, "phase", oneOf("start", "end")),
            bytesIn: maybe(d, "bytesIn", isCount),
            bytesOut: maybe(d, "bytesOut", isCount),
        }),
    ],
    [
        "secret_host",
        (d, at) => ({
            at,
            kind: "secret_host",
            host: need(d, "host", isText),
            requests: need(d, "requests", isCount),
            bytes: need(d, "bytes", isCount),
        }),
    ],
    [
        "mcp",
        (d, at) => ({
            at,
            kind: "mcp",
            tool: need(d, "tool", isText),
            outcome: need(d, "outcome", isText),
            durationMs: need(d, "durationMs", isAmount),
        }),
    ],
    [
        "x402",
        (d, at) => {
            const resolved = maybe(d, "resolved", oneOf("paid", "released")) ?? null;
            const tx = maybe(d, "tx", isText);
            return {
                at,
                kind: "x402",
                host: need(d, "host", isText),
                method: need(d, "method", isText),
                path: need(d, "path", isText),
                status: need(d, "status", isText),
                reason: need(d, "reason", isText),
                count: need(d, "count", isSeq),
                askedMicros: need(d, "askedMicros", isCount),
                amountMicros: need(d, "amountMicros", isCount),
                asset: maybe(d, "asset", isText),
                network: need(d, "network", isText),
                httpStatus: maybe(d, "httpStatus", isCount),
                durationMs: maybe(d, "durationMs", isAmount),
                bytesOut: maybe(d, "bytesOut", isCount),
                bytesIn: maybe(d, "bytesIn", isCount),
                streamCut: maybe(d, "streamCut", isFlag),
                allowanceLeftMicros: maybe(d, "allowanceLeftMicros", isCount),
                resolved,
                // Only Payments' confirmation on chain makes a transaction worth linking (R5)
                tx: resolved === "paid" ? tx : undefined,
                resent: maybe(d, "resent", isFlag) ?? false,
            };
        },
    ],
    [
        "allowance",
        (d, at) => {
            const phase = need(d, "phase", oneOf("paid", "refunded", "kept"));
            const kept = phase === "kept";
            return {
                at,
                kind: "allowance",
                phase,
                amountMicros: need(d, "amountMicros", isCount),
                keptMicros: kept ? maybe(d, "keptMicros", isCount) : undefined,
                asset: maybe(d, "asset", isText),
                network: need(d, "network", isText),
                // Money that moved has a transaction; an amount kept under the minimum never moved
                tx: kept ? undefined : need(d, "tx", isText),
            };
        },
    ],
]);

function readEvent(v: unknown): SessionEvent[] {
    if (!isDoc(v) || typeof v.kind !== "string") return [];
    const read = eventReaders.get(v.kind);
    if (!read) return [];
    try {
        return [compact(read(v, time(v, "at")))];
    } catch (err) {
        if (err instanceof PayloadError) return [];
        throw err;
    }
}

/* Jobs */

function readFrame(v: unknown): Frame {
    if (!isDoc(v)) throw new PayloadError("a frame is not an object");
    return {
        s: need(v, "s", oneOf("o", "e")),
        t: maybe(v, "t", isText) ?? "",
        cr: maybe(v, "cr", isFlag) ?? false,
    };
}

function readJob(v: unknown): Job {
    if (!isDoc(v)) throw new PayloadError("a job is not an object");
    const frames = maybe(v, "frames", isList);
    return {
        seq: need(v, "seq", isSeq),
        command: maybe(v, "command", isText) ?? null,
        state: need(v, "state", oneOf("running", "exited", "cancelled", "lost")),
        startedAt: time(v, "startedAt"),
        finishedAt: maybeTime(v, "finishedAt") ?? null,
        exitCode: maybe(v, "exitCode", isInt) ?? null,
        oom: maybe(v, "oom", isFlag) ?? false,
        peakMib: maybe(v, "peakMib", isAmount) ?? 0,
        outBytes: maybe(v, "outBytes", isCount) ?? null,
        errBytes: maybe(v, "errBytes", isCount) ?? null,
        cutBytes: maybe(v, "cutBytes", isCount) ?? 0,
        frames: frames === undefined ? null : frames.map(readFrame),
    };
}

/* Payloads */

function readRecord(d: Doc): SessionRecord {
    const startedAt = time(d, "startedAt");
    const endedAt = time(d, "endedAt");
    const deletesAt = time(d, "deletesAt");
    const output = need(d, "output", oneOf("pending", "complete", "partial", "expired"));
    const events = (maybe(d, "events", isList) ?? []).flatMap(readEvent);
    const ends = new Map<number, JobEvent>();
    for (const e of events) if (e.kind === "job" && e.phase === "end") ends.set(e.seq, e);
    // Record jobs carry no byte counts, but each job's end event does
    const jobs = (maybe(d, "jobs", isList) ?? []).map((v) => {
        const job = readJob(v);
        const end = ends.get(job.seq);
        job.outBytes ??= end?.outBytes ?? null;
        job.errBytes ??= end?.errBytes ?? null;
        return job;
    });
    return {
        startedAt,
        endedAt,
        endedBecause: endedBecause(d.endedBecause),
        deletesAt,
        output,
        events,
        eventsDropped: maybe(d, "eventsDropped", isCount) ?? 0,
        jobs,
        jobsDropped: maybe(d, "jobsDropped", isCount) ?? 0,
    };
}

function readSnapshot(d: Doc): Snapshot {
    return {
        startedAt: time(d, "startedAt"),
        deadline: time(d, "deadline"),
        now: time(d, "now"),
        jobs: (maybe(d, "jobs", isList) ?? []).map(readJob),
        jobsDropped: maybe(d, "jobsDropped", isCount) ?? 0,
    };
}

// The version is read before any other field, since a newer payload may change them all
function versioned(body: Doc, key: string): Doc | null {
    const payload = body[key];
    if (!isDoc(payload)) throw new PayloadError(`${key} is not an object`);
    return payload.v === 1 ? payload : null;
}

export function parseGetBody(body: unknown): GetBody {
    if (!isDoc(body)) throw new PayloadError("the body is not an object");
    const state = need(body, "state", isText);
    if (state === "expired") return { state: "expired" };
    if (state === "ended") {
        const record = versioned(body, "record");
        return record ? { state: "ended", record: readRecord(record) } : { state: "too-new" };
    }
    if (state === "running") {
        const snapshot = versioned(body, "snapshot");
        return snapshot
            ? { state: "running", snapshot: readSnapshot(snapshot) }
            : { state: "too-new" };
    }
    return { state: "too-new" };
}
