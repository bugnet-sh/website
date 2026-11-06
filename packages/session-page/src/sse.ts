import type { Frame } from "./payload.ts";

export interface SseEvent {
    event: string;
    data: string;
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
    return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

export function toLiveFrame(e: SseEvent): LiveFrame | null {
    let d: unknown;
    try {
        d = JSON.parse(e.data);
    } catch {
        return null;
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
        case "end": {
            const r = d.reason;
            const reason =
                typeof r === "string" && REASONS.includes(r) ? (r as EndReason) : "other";
            return { type: "end", reason };
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
    try {
        while (!signal.aborted) {
            const { done, value } = await reader.read();
            if (done) break;
            parser.push(decoder.decode(value, { stream: true }));
        }
        if (!signal.aborted) parser.push(decoder.decode());
    } catch {
        // An abort surfaces as a read error; any other failure ends the stream the same way,
        // and the caller decides whether to reconnect.
    } finally {
        signal.removeEventListener("abort", stop);
    }
}
