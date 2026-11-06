import type { Frame } from "./payload.ts";

export interface SseEvent {
    event: string;
    data: string;
    // Only this block's own id, a carried-over one is older and a resume from it shows text twice
    id: string | null;
}

export function createSseParser(onEvent: (e: SseEvent) => void): { push(text: string): void } {
    let pending = "";
    let event = "";
    let data: string[] = [];
    let hasData = false;
    let id: string | null = null;

    function line(l: string): void {
        if (l === "") {
            if (hasData) onEvent({ event: event || "message", data: data.join("\n"), id });
            event = "";
            data = [];
            hasData = false;
            id = null;
            return;
        }
        if (l.startsWith(":")) return;
        const colon = l.indexOf(":");
        const field = colon < 0 ? l : l.slice(0, colon);
        let value = colon < 0 ? "" : l.slice(colon + 1);
        if (value.startsWith(" ")) value = value.slice(1);
        if (field === "event") event = value;
        else if (field === "data") {
            data.push(value);
            hasData = true;
        } else if (field === "id" && !value.includes("\0")) id = value;
    }

    return {
        push(text) {
            pending += text;
            let start = 0;
            for (let i = 0; i < pending.length; i++) {
                const c = pending[i];
                if (c === "\n") {
                    line(pending.slice(start, i));
                    start = i + 1;
                } else if (c === "\r") {
                    // A trailing \r may be the first half of \r\n; wait for the next chunk.
                    if (i === pending.length - 1) break;
                    line(pending.slice(start, i));
                    if (pending[i + 1] === "\n") i++;
                    start = i + 1;
                }
            }
            pending = pending.slice(start);
        },
    };
}

export type EndReason = "exited" | "ended" | "closed" | "limit" | "other";
export type LiveFrame =
    | { type: "out"; frame: Frame; cursor: string | null }
    | { type: "skip"; outBytes: number; errBytes: number; cursor: string | null }
    | { type: "exit"; exitCode: number | null; oom: boolean; peakMib: number }
    | { type: "end"; reason: EndReason };

const REASONS: readonly string[] = ["exited", "ended", "closed", "limit"];

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function count(v: unknown): number | null {
    return typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null;
}

export function toLiveFrame(e: SseEvent): LiveFrame | null {
    let d: unknown;
    try {
        d = JSON.parse(e.data);
    } catch {
        d = undefined;
    }
    // An end with bad data still ends the stream, so it is not resumed like a drop
    if (e.event === "end") {
        const r = isObject(d) ? d.reason : undefined;
        const reason = typeof r === "string" && REASONS.includes(r) ? (r as EndReason) : "other";
        return { type: "end", reason };
    }
    if (!isObject(d)) return null;
    switch (e.event) {
        case "out":
            if (
                (d.s === "o" || d.s === "e") &&
                typeof d.t === "string" &&
                typeof d.cr === "boolean"
            ) {
                return { type: "out", frame: { s: d.s, t: d.t, cr: d.cr }, cursor: e.id };
            }
            return null;
        case "skip": {
            const outBytes = count(d.outBytes);
            const errBytes = count(d.errBytes);
            if (outBytes === null || errBytes === null) return null;
            return { type: "skip", outBytes, errBytes, cursor: e.id };
        }
        case "exit": {
            const peakMib = count(d.peakMib);
            const code = d.exitCode;
            if (peakMib === null || typeof d.oom !== "boolean") return null;
            if (code !== null && (typeof code !== "number" || !Number.isInteger(code))) return null;
            return { type: "exit", exitCode: code, oom: d.oom, peakMib };
        }
        default:
            return null;
    }
}

export async function readSse(
    res: Response,
    onFrame: (f: LiveFrame) => void,
    signal: AbortSignal,
): Promise<void> {
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    const parser = createSseParser((e) => {
        const f = toLiveFrame(e);
        if (f) onFrame(f);
    });
    const stop = (): void => {
        reader.cancel().catch(() => {});
    };
    signal.addEventListener("abort", stop, { once: true });
    let finished = false;
    try {
        while (!signal.aborted) {
            let chunk: ReadableStreamReadResult<Uint8Array>;
            try {
                chunk = await reader.read();
            } catch {
                // An abort surfaces as a read error; any other read failure ends the stream the
                // same way, and the caller decides whether to reconnect. Errors from onFrame are
                // not caught here, so a caller bug is reported instead of looking like a clean end.
                break;
            }
            if (chunk.done) {
                finished = true;
                break;
            }
            parser.push(decoder.decode(chunk.value, { stream: true }));
        }
        if (finished) parser.push(decoder.decode());
    } finally {
        signal.removeEventListener("abort", stop);
        // Without this a stream abandoned on error or abort stays open on the server.
        if (!finished) stop();
    }
}
