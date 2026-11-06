import { describe, expect, it } from "vitest";
import { createSseParser, readSse, toLiveFrame, type LiveFrame, type SseEvent } from "./sse.ts";

const SAMPLE =
    ": keepalive\n\n" +
    'event: out\nid: c1\ndata: {"s":"o","t":"héllo","cr":false}\n\n' +
    'event: out\r\nid: c2\r\ndata: {"s":"e","t":"oops","cr":true}\r\n\r\n' +
    ": keepalive\n\n" +
    'event: out\ndata: {"s":"o","t":"no id","cr":false}\n\n' +
    'event: skip\nid: c3\ndata: {"outBytes":10,"errBytes":2}\n\n' +
    'event: exit\ndata: {"exitCode":0,"oom":false,"peakMib":12}\n\n' +
    'event: end\ndata: {"reason":"exited"}\n\n';

const EXPECTED: LiveFrame[] = [
    { type: "out", frame: { s: "o", t: "héllo", cr: false }, cursor: "c1" },
    { type: "out", frame: { s: "e", t: "oops", cr: true }, cursor: "c2" },
    // The id field persists across events, as the event-stream rules say
    { type: "out", frame: { s: "o", t: "no id", cr: false }, cursor: "c2" },
    { type: "skip", outBytes: 10, errBytes: 2, cursor: "c3" },
    { type: "exit", exitCode: 0, oom: false, peakMib: 12 },
    { type: "end", reason: "exited" },
];

function frames(chunks: string[]): LiveFrame[] {
    const out: LiveFrame[] = [];
    const p = createSseParser((e) => {
        const f = toLiveFrame(e);
        if (f) out.push(f);
    });
    for (const c of chunks) p.push(c);
    return out;
}

describe("createSseParser", () => {
    it("decodes the sample stream", () => {
        expect(frames([SAMPLE])).toEqual(EXPECTED);
    });

    it("gives the same frames when split at every character offset", () => {
        for (let i = 0; i <= SAMPLE.length; i++) {
            expect(frames([SAMPLE.slice(0, i), SAMPLE.slice(i)]), `split at ${i}`).toEqual(
                EXPECTED,
            );
        }
    });

    it("gives the same frames one character at a time", () => {
        expect(frames([...SAMPLE])).toEqual(EXPECTED);
    });

    it("holds a trailing CR until the next chunk", () => {
        const events: SseEvent[] = [];
        const p = createSseParser((e) => events.push(e));
        p.push("data: a\r");
        p.push("\ndata: b\n\n");
        expect(events).toEqual([{ event: "message", data: "a\nb", id: null }]);
    });

    it("joins data lines with newlines and strips one leading space", () => {
        const events: SseEvent[] = [];
        const p = createSseParser((e) => events.push(e));
        p.push("data:  x\ndata:y\ndata\n\n");
        expect(events[0]!.data).toBe(" x\ny\n");
    });

    it("treats a lone CR as a line end", () => {
        const events: SseEvent[] = [];
        const p = createSseParser((e) => events.push(e));
        p.push("data: a\r\rdata: b\r\r");
        // The final CR waits for a possible LF, so the next chunk releases the last event
        p.push("x");
        expect(events.map((e) => e.data)).toEqual(["a", "b"]);
    });
});

describe("toLiveFrame", () => {
    it("gives no frame for an unknown event name", () => {
        expect(toLiveFrame({ event: "mystery", data: "{}", id: null })).toBeNull();
    });

    it("gives no frame for malformed data", () => {
        expect(toLiveFrame({ event: "out", data: "nope", id: null })).toBeNull();
        expect(
            toLiveFrame({ event: "out", data: '{"s":"x","t":"","cr":false}', id: null }),
        ).toBeNull();
        expect(toLiveFrame({ event: "skip", data: "{}", id: null })).toBeNull();
    });

    it("maps an unknown end reason to other", () => {
        expect(toLiveFrame({ event: "end", data: '{"reason":"weird"}', id: null })).toEqual({
            type: "end",
            reason: "other",
        });
    });

    it("accepts a null exit code", () => {
        expect(
            toLiveFrame({
                event: "exit",
                data: '{"exitCode":null,"oom":true,"peakMib":3}',
                id: null,
            }),
        ).toEqual({ type: "exit", exitCode: null, oom: true, peakMib: 3 });
    });
});

function streamOf(chunks: Uint8Array[]): Response {
    return new Response(
        new ReadableStream({
            start(c) {
                for (const chunk of chunks) c.enqueue(chunk);
                c.close();
            },
        }),
    );
}

describe("readSse", () => {
    it("decodes multi-byte characters split across chunks", async () => {
        const bytes = new TextEncoder().encode(
            'event: out\ndata: {"s":"o","t":"é€","cr":false}\n\n',
        );
        const chunks: Uint8Array[] = [];
        // One byte per chunk splits both the 2-byte and the 3-byte character
        for (const b of bytes) chunks.push(Uint8Array.of(b));
        const got: LiveFrame[] = [];
        await readSse(streamOf(chunks), (f) => got.push(f), new AbortController().signal);
        expect(got).toEqual([{ type: "out", frame: { s: "o", t: "é€", cr: false }, cursor: null }]);
    });

    it("ends without throwing when the signal aborts", async () => {
        const ac = new AbortController();
        const res = new Response(new ReadableStream({ start() {} }));
        const done = readSse(res, () => {}, ac.signal);
        ac.abort();
        await expect(done).resolves.toBeUndefined();
    });

    it("rejects and cancels the body when onFrame throws", async () => {
        let cancelled = false;
        const body = new ReadableStream<Uint8Array>({
            start(c) {
                c.enqueue(new TextEncoder().encode('event: end\ndata: {"reason":"exited"}\n\n'));
            },
            cancel() {
                cancelled = true;
            },
        });
        const boom = new Error("render bug");
        await expect(
            readSse(
                new Response(body),
                () => {
                    throw boom;
                },
                new AbortController().signal,
            ),
        ).rejects.toBe(boom);
        expect(cancelled).toBe(true);
    });

    it("cancels the body when the signal is already aborted", async () => {
        let cancelled = false;
        const body = new ReadableStream<Uint8Array>({
            cancel() {
                cancelled = true;
            },
        });
        const ac = new AbortController();
        ac.abort();
        await expect(readSse(new Response(body), () => {}, ac.signal)).resolves.toBeUndefined();
        expect(cancelled).toBe(true);
    });

    it("resolves with the frames delivered before a mid-read error", async () => {
        let sent = false;
        const body = new ReadableStream<Uint8Array>({
            pull(c) {
                if (sent) {
                    c.error(new Error("network"));
                    return;
                }
                sent = true;
                c.enqueue(new TextEncoder().encode('event: end\ndata: {"reason":"exited"}\n\n'));
            },
        });
        const got: LiveFrame[] = [];
        await expect(
            readSse(new Response(body), (f) => got.push(f), new AbortController().signal),
        ).resolves.toBeUndefined();
        expect(got).toEqual([{ type: "end", reason: "exited" }]);
    });
});
