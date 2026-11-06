import { describe, expect, it, vi } from "vitest";
import type { Api, ApiError } from "./api.ts";
import { createLive, type Live } from "./live.ts";
import { OutputBuffer } from "./output.ts";
import type { LiveFrame } from "./sse.ts";

interface Stream {
    seq: number;
    cursor: string | null;
    signal: AbortSignal;
    send(text: string): void;
    // Closes the body without an end frame, as a dropped connection does
    close(): void;
    cancelled: boolean;
}

const encoder = new TextEncoder();

function fakeApi() {
    const streams: Stream[] = [];
    // Answers for the next live() calls of a seq, before it falls back to an open stream
    const answers = new Map<number, ApiError[]>();
    const live = async (seq: number, cursor: string | null, signal: AbortSignal) => {
        const queued = answers.get(seq)?.shift();
        if (queued !== undefined) return queued;
        let controller!: ReadableStreamDefaultController<Uint8Array>;
        const stream: Stream = {
            seq,
            cursor,
            signal,
            send: (text) => controller.enqueue(encoder.encode(text)),
            close: () => controller.close(),
            cancelled: false,
        };
        const body = new ReadableStream<Uint8Array>({
            start(c) {
                controller = c;
            },
            cancel() {
                stream.cancelled = true;
            },
        });
        streams.push(stream);
        return new Response(body);
    };
    const api: Api = {
        get: async () => ({ ok: false, error: "offline" }),
        remove: async () => ({ ok: false, error: "offline" }),
        live,
    };
    return { api, streams, answers };
}

function fakeClock() {
    let now = 0;
    let next = 0;
    const timers = new Map<number, { at: number; cb: () => void }>();
    return {
        setTimer(cb: () => void, ms: number): unknown {
            timers.set(++next, { at: now + ms, cb });
            return next;
        },
        clearTimer(t: unknown) {
            timers.delete(t as number);
        },
        advance(ms: number) {
            const until = now + ms;
            for (;;) {
                const due = [...timers.entries()]
                    .filter(([, t]) => t.at <= until)
                    .sort((a, b) => a[1].at - b[1].at)[0];
                if (!due) break;
                timers.delete(due[0]);
                now = due[1].at;
                due[1].cb();
            }
            now = until;
        },
    };
}

// Lets the stream readers take every chunk already queued
const settle = () => new Promise((resolve) => setImmediate(resolve));

function event(name: string, data: unknown, id?: string): string {
    const idLine = id === undefined ? "" : `id: ${id}\n`;
    return `event: ${name}\n${idLine}data: ${JSON.stringify(data)}\n\n`;
}

const sse = {
    out: (t: string, id?: string) => event("out", { s: "o", t, cr: false }, id),
    exit: (exitCode: number) => event("exit", { exitCode, oom: false, peakMib: 8 }),
    end: (reason: string) => event("end", { reason }),
};

function setup(opts: { onFrame?: (seq: number, f: LiveFrame) => void } = {}) {
    const fake = fakeApi();
    const clock = fakeClock();
    const states: [number, string][] = [];
    const onGone = vi.fn();
    const onSessionEnd = vi.fn();
    const frames: [number, LiveFrame][] = [];
    const live: Live = createLive({
        api: fake.api,
        maxStreams: 4,
        retryMs: 2_000,
        onFrame: opts.onFrame ?? ((seq, f) => void frames.push([seq, f])),
        onState: (seq, s) => void states.push([seq, s]),
        onGone,
        onSessionEnd,
        setTimer: clock.setTimer,
        clearTimer: clock.clearTimer,
    });
    const stateOf = (seq: number) => states.filter(([s]) => s === seq).at(-1)?.[1];
    const openSeqs = () => fake.streams.filter((s) => !s.signal.aborted).map((s) => s.seq);
    return { ...fake, clock, states, stateOf, openSeqs, onGone, onSessionEnd, frames, live };
}

describe("createLive", () => {
    it("streams the first four wanted seqs and keeps the other two waiting", async () => {
        const t = setup();
        t.live.setWanted([6, 5, 4, 3, 2, 1]);
        await settle();
        expect(t.openSeqs()).toEqual([6, 5, 4, 3]);
        for (const seq of [6, 5, 4, 3]) expect(t.stateOf(seq)).toBe("streaming");
        expect(t.stateOf(2)).toBe("waiting");
        expect(t.stateOf(1)).toBe("waiting");
    });

    it("counts a seq listed twice once", async () => {
        const t = setup();
        t.live.setWanted([3, 3, 2, 2, 1]);
        await settle();
        expect(t.openSeqs()).toEqual([3, 2, 1]);
    });

    it("aborts the lowest stream when a waiting seq moves to the front", async () => {
        const t = setup();
        t.live.setWanted([1, 2, 3, 4, 5, 6]);
        await settle();
        t.streams.find((s) => s.seq === 4)!.send(sse.out("four\n", "c4"));
        await settle();
        t.live.setWanted([5, 1, 2, 3, 4, 6]);
        await settle();
        const four = t.streams.find((s) => s.seq === 4)!;
        expect(four.signal.aborted).toBe(true);
        expect(four.cancelled).toBe(true);
        expect(t.stateOf(4)).toBe("waiting");
        expect(t.openSeqs()).toEqual([1, 2, 3, 5]);
        expect(t.stateOf(5)).toBe("streaming");

        // It keeps its cursor for when a slot frees up again
        t.live.setWanted([4, 1, 2, 3]);
        await settle();
        expect(t.streams.at(-1)).toMatchObject({ seq: 4, cursor: "c4" });
    });

    it("retries a dropped stream after 2,000 ms from its last cursor", async () => {
        const t = setup();
        t.live.setWanted([1]);
        await settle();
        t.streams[0]!.send(sse.out("a\n", "c7"));
        t.streams[0]!.close();
        await settle();
        t.clock.advance(1_999);
        await settle();
        expect(t.streams).toHaveLength(1);
        t.clock.advance(1);
        await settle();
        expect(t.streams).toHaveLength(2);
        expect(t.streams[1]).toMatchObject({ seq: 1, cursor: "c7" });
        expect(t.stateOf(1)).toBe("streaming");
    });

    it("starts with no cursor and keeps the last one through a drop with none", async () => {
        const t = setup();
        t.live.setWanted([1]);
        await settle();
        expect(t.streams[0]!.cursor).toBeNull();
        t.streams[0]!.close();
        await settle();
        t.clock.advance(2_000);
        await settle();
        expect(t.streams[1]!.cursor).toBeNull();
    });

    it("never shows text twice across a resume", async () => {
        const buffer = new OutputBuffer();
        const t = setup({
            onFrame: (_seq, f) => {
                if (f.type === "out") buffer.apply(f.frame);
            },
        });
        t.live.setWanted([1]);
        await settle();
        t.streams[0]!.send(sse.out("a", "c1") + sse.out("b"));
        t.streams[0]!.close();
        await settle();
        t.clock.advance(2_000);
        await settle();
        expect(t.streams[1]!.cursor).toBe("c1");
        t.streams[1]!.send(sse.out("b", "c2"));
        await settle();
        expect(buffer.text()).toBe("ab");
    });

    it("holds frames without a cursor until a frame with one, an exit or an end", async () => {
        const t = setup();
        t.live.setWanted([1, 2]);
        await settle();
        const [one, two] = t.streams;
        one!.send(sse.out("x") + sse.out("y"));
        two!.send(sse.out("p"));
        await settle();
        expect(t.frames).toEqual([]);
        one!.send(sse.out("z", "c1"));
        await settle();
        expect(t.frames.map(([seq, f]) => [seq, f.type === "out" ? f.frame.t : f.type])).toEqual([
            [1, "x"],
            [1, "y"],
            [1, "z"],
        ]);
        two!.send(sse.exit(0));
        await settle();
        expect(t.frames.slice(3).map(([seq, f]) => [seq, f.type])).toEqual([
            [2, "out"],
            [2, "exit"],
        ]);
    });

    it("never retries a seq that sent exit and end{exited}, and gives its slot away", async () => {
        const t = setup();
        t.live.setWanted([1, 2, 3, 4, 5]);
        await settle();
        t.streams[0]!.send(sse.out("done\n", "c1") + sse.exit(0) + sse.end("exited"));
        await settle();
        expect(t.stateOf(1)).toBe("done");
        expect(t.stateOf(5)).toBe("streaming");
        t.clock.advance(60_000);
        t.live.setWanted([1, 2, 3, 4, 5]);
        await settle();
        expect(t.streams.filter((s) => s.seq === 1)).toHaveLength(1);
        expect(t.frames.map(([, f]) => f.type)).toEqual(["out", "exit"]);
    });

    it("does not resume a stream that dropped after its exit", async () => {
        const t = setup();
        t.live.setWanted([1]);
        await settle();
        t.streams[0]!.send(sse.exit(1));
        t.streams[0]!.close();
        await settle();
        t.clock.advance(60_000);
        await settle();
        expect(t.streams).toHaveLength(1);
        expect(t.stateOf(1)).toBe("done");
    });

    it("calls onGone once on a 404 and opens nothing more", async () => {
        const t = setup();
        t.answers.set(1, ["not-found"]);
        t.answers.set(2, ["not-found"]);
        t.live.setWanted([1, 2, 3]);
        await settle();
        expect(t.onGone).toHaveBeenCalledTimes(1);
        // Seq 3's answer came after the 404, so its body is cancelled unread
        expect(t.streams.map((s) => [s.seq, s.signal.aborted, s.cancelled])).toEqual([
            [3, true, true],
        ]);
        const calls = t.streams.length;
        t.clock.advance(60_000);
        t.live.setWanted([4, 5]);
        await settle();
        expect(t.streams).toHaveLength(calls);
        expect(t.onGone).toHaveBeenCalledTimes(1);
    });

    it("waits five times longer after a 429", async () => {
        const t = setup();
        t.answers.set(1, ["rate-limited"]);
        t.live.setWanted([1]);
        await settle();
        t.clock.advance(9_999);
        await settle();
        expect(t.streams).toHaveLength(0);
        t.clock.advance(1);
        await settle();
        expect(t.streams).toHaveLength(1);
    });

    it("retries after 2,000 ms when the route answers neither 200, 404 nor 429", async () => {
        const t = setup();
        t.answers.set(1, ["offline"]);
        t.live.setWanted([1]);
        await settle();
        t.clock.advance(2_000);
        await settle();
        expect(t.streams).toHaveLength(1);
    });

    it("calls onSessionEnd on end{ended} and stops every stream", async () => {
        const t = setup();
        t.live.setWanted([1, 2]);
        await settle();
        t.streams[1]!.send(sse.out("held") + sse.end("ended"));
        await settle();
        expect(t.onSessionEnd).toHaveBeenCalledExactlyOnceWith("ended");
        expect(t.frames.map(([seq, f]) => [seq, f.type])).toEqual([[2, "out"]]);
        expect(t.streams.every((s) => s.signal.aborted)).toBe(true);
        t.clock.advance(60_000);
        await settle();
        expect(t.streams).toHaveLength(2);
    });

    it("calls onSessionEnd on end{closed}", async () => {
        const t = setup();
        t.live.setWanted([1]);
        await settle();
        t.streams[0]!.send(sse.end("closed"));
        await settle();
        expect(t.onSessionEnd).toHaveBeenCalledExactlyOnceWith("closed");
    });

    it("marks a seq limit on end{limit} and never reopens it", async () => {
        const t = setup();
        t.live.setWanted([1]);
        await settle();
        t.streams[0]!.send(sse.end("limit"));
        await settle();
        expect(t.stateOf(1)).toBe("limit");
        t.clock.advance(60_000);
        t.live.setWanted([1]);
        await settle();
        expect(t.streams).toHaveLength(1);
    });

    it("treats a throwing onFrame as a dropped stream", async () => {
        let fail = true;
        const t = setup({
            onFrame: () => {
                if (fail) throw new Error("render bug");
            },
        });
        t.live.setWanted([1]);
        await settle();
        t.streams[0]!.send(sse.out("a", "c1"));
        await settle();
        expect(t.streams[0]!.cancelled).toBe(true);
        fail = false;
        t.clock.advance(2_000);
        await settle();
        expect(t.streams).toHaveLength(2);
        expect(t.streams[1]!.cursor).toBeNull();
    });

    it("stopAll aborts every open stream and every pending retry", async () => {
        const t = setup();
        t.live.setWanted([1, 2, 3]);
        await settle();
        t.streams[2]!.close();
        await settle();
        t.live.stopAll();
        await settle();
        // The third already dropped and waits for its retry, which stopAll clears
        for (const s of t.streams.slice(0, 2)) {
            expect(s.signal.aborted).toBe(true);
            expect(s.cancelled).toBe(true);
        }
        t.clock.advance(60_000);
        t.live.setWanted([1, 2, 3, 4]);
        await settle();
        expect(t.streams).toHaveLength(3);
    });
});
