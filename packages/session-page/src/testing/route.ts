/**
 * A fake sessions route for the tests and the dev server, with the rules of session-page.md 7.2.
 *
 * It serves a built bundle with the headers its headers.txt lists, answers the page calls from
 * the sample scenarios it is given, plays each running job's scripted live stream, and records
 * every request so a test can check what the browser sent.
 *
 * A stream's `id:` is the number of frames sent so far, and a resume from it goes on after them.
 * The running placement's clock starts at its first call and ends `liveDelayMs * 150` later:
 * then every open stream gets `end {"reason":"ended"}` and asks answer ended-full's record. A
 * delete forgets a session for good and ends its streams with `closed`.
 */
import {
    createServer,
    type IncomingHttpHeaders,
    type IncomingMessage,
    type ServerResponse,
} from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { headersFile } from "../build.ts";
import { ID_RE } from "../link.ts";
import type { GetAnswer, Json, LiveScript, Scenario } from "./fixtures.ts";

export interface Recorded {
    method: string;
    path: string;
    headers: IncomingHttpHeaders;
    body: string;
}

export interface FakeRoute {
    origin: string;
    requests: Recorded[];
    close(): Promise<void>;
}

const MAX_BODY = 1_024;
const KEEPALIVE_MS = 15_000;
const RUNNING_FRAMES = 150;

const types: Record<string, string> = {
    js: "text/javascript; charset=utf-8",
    css: "text/css; charset=utf-8",
    svg: "image/svg+xml",
    woff2: "font/woff2",
};

interface Stream {
    end(reason: "ended" | "closed"): void;
    // Stops its timers without a word to the page, for when the route itself shuts down
    drop(): void;
}

interface Session {
    scenario: Scenario;
    asks: number;
    deleted: boolean;
    // When the running placement ends, from its first call; null until then
    endsAt: number | null;
    streams: Set<Stream>;
}

async function readHeaders(dist: string): Promise<[string, string][]> {
    const text = await readFile(join(dist, headersFile), "utf8");
    return text
        .split("\n")
        .filter((l) => l.trim() !== "")
        .map((l) => {
            const at = l.indexOf(":");
            if (at < 1) throw new Error(`headers file line ${JSON.stringify(l)} has no name`);
            return [l.slice(0, at).trim(), l.slice(at + 1).trim()];
        });
}

// Read whole, so the client is never cut off mid-send; past the cap only the size counts
async function readBody(req: IncomingMessage): Promise<{ text: string; size: number }> {
    const kept: Buffer[] = [];
    let size = 0;
    for await (const chunk of req as AsyncIterable<Buffer>) {
        if (size <= MAX_BODY) kept.push(chunk);
        size += chunk.length;
    }
    return { text: Buffer.concat(kept).toString("utf8"), size };
}

function parseBody(text: string): { k: unknown; cursor: unknown } | null {
    try {
        const doc = JSON.parse(text) as Json;
        if (typeof doc !== "object" || doc === null || Array.isArray(doc)) return null;
        return { k: doc.k, cursor: doc.cursor };
    } catch {
        return null;
    }
}

function cursorStart(cursor: unknown, script: LiveScript): number {
    if (typeof cursor !== "string" || !/^\d+$/.test(cursor)) return 0;
    const n = Number(cursor);
    return n <= script.frames.length ? n : 0;
}

export async function startFakeRoute(
    dist: string,
    scenarios: Record<string, Scenario>,
    opts: { port?: number; liveDelayMs?: number } = {},
): Promise<FakeRoute> {
    const headers = Object.fromEntries(await readHeaders(dist));
    const liveDelayMs = opts.liveDelayMs ?? 400;
    const requests: Recorded[] = [];
    const timers = new Set<NodeJS.Timeout>();
    const sessions = new Map<string, Session>();
    for (const scenario of Object.values(scenarios)) {
        sessions.set(scenario.id, {
            scenario,
            asks: 0,
            deleted: false,
            endsAt: null,
            streams: new Set(),
        });
    }
    const afterEnd: GetAnswer = Object.values(scenarios).find((s) => s.kind === "ended-full")
        ?.gets[0] ?? { status: 200, body: { state: "expired" } };
    let origin = "";

    function send(
        res: ServerResponse,
        status: number,
        body?: { type: string; bytes: string | Buffer },
    ): void {
        res.writeHead(status, body ? { ...headers, "content-type": body.type } : headers);
        res.end(body?.bytes);
    }

    const sendJson = (res: ServerResponse, answer: GetAnswer): void =>
        answer.body === null
            ? send(res, answer.status)
            : send(res, answer.status, {
                  type: "application/json",
                  bytes: JSON.stringify(answer.body),
              });

    async function sendFile(res: ServerResponse, file: string, type: string): Promise<void> {
        let bytes: Buffer;
        try {
            bytes = await readFile(file);
        } catch {
            return send(res, 404);
        }
        send(res, 200, { type, bytes });
    }

    function later(cb: () => void, ms: number): void {
        const t = setTimeout(() => {
            timers.delete(t);
            cb();
        }, ms);
        timers.add(t);
    }

    function running(session: Session): boolean {
        if (session.scenario.kind !== "running") return false;
        if (session.endsAt === null) {
            const ms = liveDelayMs * RUNNING_FRAMES;
            session.endsAt = Date.now() + ms;
            later(() => {
                for (const s of session.streams) s.end("ended");
            }, ms);
        }
        return Date.now() < session.endsAt;
    }

    // A page call must come from the page itself, and a same-site preview counts as cross-site.
    // Like the sessions role, a missing Sec-Fetch-Site is refused too
    function pageCall(h: IncomingHttpHeaders): boolean {
        const type = (h["content-type"] ?? "").split(";")[0]?.trim().toLowerCase();
        if (type !== "application/json" || h.origin !== origin) return false;
        return h["sec-fetch-site"] === "same-origin";
    }

    function stream(res: ServerResponse, session: Session, script: LiveScript, from: number): void {
        res.writeHead(200, { ...headers, "content-type": "text/event-stream" });
        res.flushHeaders();
        const event = (name: string, data: Json, id?: number): void => {
            const idLine = id === undefined ? "" : `id: ${id}\n`;
            res.write(`event: ${name}\n${idLine}data: ${JSON.stringify(data)}\n\n`);
        };
        let next = from;
        const tick = setInterval(() => {
            const frame = script.frames[next];
            if (frame) {
                next += 1;
                event("out", frame, next);
                return;
            }
            clearInterval(tick);
            // A job still running holds its stream open until the placement ends
            if (script.exit === null) return;
            event("exit", { ...script.exit });
            end("exited");
        }, liveDelayMs);
        const keepalive = setInterval(() => res.write(": keepalive\n\n"), KEEPALIVE_MS);
        const self: Stream = { end, drop };
        function drop(): void {
            clearInterval(tick);
            clearInterval(keepalive);
            session.streams.delete(self);
        }
        function end(reason: "exited" | "ended" | "closed"): void {
            drop();
            event("end", { reason });
            res.end();
        }
        session.streams.add(self);
        res.on("close", drop);
    }

    async function v1(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
        const { text, size } = await readBody(req);
        requests.push({ method: req.method ?? "", path, headers: req.headers, body: text });
        if (!pageCall(req.headers)) return send(res, 403);
        if (size > MAX_BODY) return send(res, 413);

        const match = /^\/v1\/s\/([^/]+)(?:\/jobs\/(\d+)\/live)?$/.exec(path);
        const session = match ? sessions.get(match[1]!) : undefined;
        const body = parseBody(text);
        if (!match || !session || session.deleted || body?.k !== session.scenario.key) {
            return send(res, 404);
        }
        const seq = match[2];
        const limited = session.scenario.kind === "rate-limited";
        if (seq === undefined && req.method === "POST") {
            const ended = session.scenario.kind === "running" && !running(session);
            const gets = session.scenario.gets;
            const answer = ended ? afterEnd : gets[Math.min(session.asks, gets.length - 1)]!;
            session.asks += 1;
            return sendJson(res, answer);
        }
        if (seq === undefined && req.method === "DELETE") {
            if (limited) return send(res, 429);
            session.deleted = true;
            for (const s of session.streams) s.end("closed");
            return send(res, 204);
        }
        if (seq !== undefined && req.method === "POST") {
            if (limited) return send(res, 429);
            const script = session.scenario.live[Number(seq)];
            if (!script || !running(session)) return send(res, 404);
            return stream(res, session, script, cursorStart(body.cursor, script));
        }
        send(res, 404);
    }

    async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const path = (req.url ?? "/").split("?")[0] ?? "/";
        if (path.startsWith("/v1/")) return v1(req, res, path);
        requests.push({ method: req.method ?? "", path, headers: req.headers, body: "" });
        if (req.method !== "GET") return send(res, 404);

        // The id is never looked up, so a GET tells nothing about which sessions exist
        if (path.startsWith("/s/")) {
            if (!ID_RE.test(path.slice("/s/".length))) return send(res, 404);
            return sendFile(res, join(dist, "index.html"), "text/html; charset=utf-8");
        }
        const asset = /^\/assets\/([A-Za-z0-9-]+\.([a-z0-9]+))$/.exec(path);
        if (asset) {
            const type = types[asset[2]!];
            if (!type) return send(res, 404);
            return sendFile(res, join(dist, "assets", asset[1]!), type);
        }
        if (path === "/robots.txt") {
            return send(res, 200, {
                type: "text/plain; charset=utf-8",
                bytes: "User-agent: *\nDisallow: /\n",
            });
        }
        send(res, 404);
    }

    // Large like the real role's, so a full bugnet.sh cookie jar never breaks the page
    const server = createServer({ maxHeaderSize: 1024 * 1024 }, (req, res) => {
        handle(req, res).catch(() => {
            if (!res.headersSent) send(res, 500);
        });
    });
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(opts.port ?? 0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("no port");
    origin = `http://127.0.0.1:${address.port}`;

    return {
        origin,
        requests,
        close: () =>
            new Promise<void>((resolve) => {
                for (const t of timers) clearTimeout(t);
                timers.clear();
                for (const session of sessions.values()) {
                    for (const s of session.streams) s.drop();
                }
                server.closeAllConnections();
                server.close(() => resolve());
            }),
    };
}
