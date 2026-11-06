import type { Api } from "./api.ts";
import { readSse, type EndReason, type LiveFrame } from "./sse.ts";

export type StreamState = "streaming" | "waiting" | "limit" | "done";

export interface Live {
    setWanted(order: number[]): void;
    stopAll(): void;
}

export interface LiveOpts {
    api: Api;
    maxStreams: number;
    retryMs: number;
    onFrame(seq: number, f: LiveFrame): void;
    onState(seq: number, s: StreamState): void;
    // A 404 on a stream: the link stopped working
    onGone(): void;
    onSessionEnd(reason: "ended" | "closed"): void;
    setTimer(cb: () => void, ms: number): unknown;
    clearTimer(t: unknown): void;
}

// A 429 means the route is already limiting this viewer, so asking again soon only adds load
const RATE_LIMITED_FACTOR = 5;

type Held = Extract<LiveFrame, { type: "out" | "skip" }>;
type Phase = "idle" | "open" | "retry" | "waiting" | "limit" | "done";

interface Track {
    seq: number;
    phase: Phase;
    reported: StreamState | null;
    // The last cursor whose text was delivered, so a resume repeats nothing
    cursor: string | null;
    conn: AbortController | null;
    timer: unknown;
    held: Held[];
    exited: boolean;
}

/**
 * Keeps at most `maxStreams` live streams open, for the wanted seqs in priority order, and
 * resumes each from its cursor after a drop (live-logs-research.md 2.4).
 *
 * Text that arrives without a cursor is held until a frame with one, an exit or an end: the
 * router sends an id only when it holds nothing back (2.6), so text without one is sent again
 * after a resume and is thrown away on a drop.
 */
export function createLive(opts: LiveOpts): Live {
    const tracks = new Map<number, Track>();
    let wanted: number[] = [];
    let stopped = false;

    function track(seq: number): Track {
        let t = tracks.get(seq);
        if (!t) {
            t = {
                seq,
                phase: "idle",
                reported: null,
                cursor: null,
                conn: null,
                timer: undefined,
                held: [],
                exited: false,
            };
            tracks.set(seq, t);
        }
        return t;
    }

    function report(t: Track, state: StreamState): void {
        if (t.reported === state) return;
        t.reported = state;
        opts.onState(t.seq, state);
    }

    function halt(t: Track): void {
        const conn = t.conn;
        t.conn = null;
        conn?.abort();
        if (t.timer !== undefined) opts.clearTimer(t.timer);
        t.timer = undefined;
        t.held = [];
    }

    function stopEverything(): void {
        stopped = true;
        for (const t of tracks.values()) halt(t);
    }

    function reconcile(): void {
        if (stopped) return;
        const slots = new Set<number>();
        for (const seq of wanted) {
            if (slots.size >= opts.maxStreams) break;
            const phase = tracks.get(seq)?.phase;
            if (phase !== "done" && phase !== "limit") slots.add(seq);
        }
        for (const t of tracks.values()) {
            if (slots.has(t.seq) || (t.phase !== "open" && t.phase !== "retry")) continue;
            halt(t);
            t.phase = "waiting";
            report(t, "waiting");
        }
        for (const seq of wanted) {
            const t = track(seq);
            if (slots.has(seq)) {
                if (t.phase === "idle" || t.phase === "waiting") open(t);
            } else if (t.phase === "idle") {
                t.phase = "waiting";
                report(t, "waiting");
            }
        }
    }

    function open(t: Track): void {
        const conn = new AbortController();
        t.conn = conn;
        t.phase = "open";
        t.held = [];
        report(t, "streaming");
        void read(t, conn);
    }

    async function read(t: Track, conn: AbortController): Promise<void> {
        let wait = opts.retryMs;
        try {
            const res = await opts.api.live(t.seq, t.cursor, conn.signal);
            if (t.conn !== conn) {
                if (typeof res !== "string") res.body?.cancel().catch(() => {});
                return;
            }
            if (res === "not-found") {
                stopEverything();
                opts.onGone();
                return;
            }
            if (res === "rate-limited") wait = opts.retryMs * RATE_LIMITED_FACTOR;
            else if (typeof res !== "string") {
                await readSse(res, (f) => receive(t, conn, f), conn.signal);
            }
        } catch {
            // A broken body or a throw from onFrame ends this stream like a network drop does
        }
        if (t.conn !== conn) return;
        t.conn = null;
        t.held = [];
        if (t.exited) {
            settle(t, "done");
            return;
        }
        t.phase = "retry";
        t.timer = opts.setTimer(() => {
            t.timer = undefined;
            if (!stopped && t.phase === "retry") open(t);
        }, wait);
    }

    function receive(t: Track, conn: AbortController, f: LiveFrame): void {
        if (t.conn !== conn) return;
        if ((f.type === "out" || f.type === "skip") && f.cursor === null) {
            t.held.push(f);
            return;
        }
        const held = t.held;
        t.held = [];
        for (const h of held) opts.onFrame(t.seq, h);
        if (f.type === "end") {
            end(t, f.reason);
            return;
        }
        // Set first, so a throwing onFrame cannot turn a finished job into a reconnect loop
        if (f.type === "exit") t.exited = true;
        opts.onFrame(t.seq, f);
        if (f.type !== "exit") t.cursor = f.cursor;
    }

    function end(t: Track, reason: EndReason): void {
        if (reason === "ended" || reason === "closed") {
            stopEverything();
            opts.onSessionEnd(reason);
            return;
        }
        halt(t);
        // An unknown reason still closed the stream on purpose, so it is not resumed
        settle(t, reason === "limit" ? "limit" : "done");
    }

    function settle(t: Track, state: "limit" | "done"): void {
        t.phase = state;
        report(t, state);
        // Its slot goes to the next wanted seq
        reconcile();
    }

    return {
        setWanted(order) {
            if (stopped) return;
            wanted = [...order];
            reconcile();
        },
        stopAll: stopEverything,
    };
}
