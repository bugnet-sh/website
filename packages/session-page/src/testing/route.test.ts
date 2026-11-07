import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildPage, headersFile } from "../build.ts";
import { createSseParser, type SseEvent } from "../sse.ts";
import { makeScenarios, type Scenario, type ScenarioName } from "./fixtures.ts";
import { startFakeRoute, type FakeRoute } from "./route.ts";

let root = "";
let dist = "";
let headerLines: [string, string][] = [];
let route: FakeRoute | null = null;
let scenarios = makeScenarios(new Date());

beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "bugnet-session-route-"));
    dist = join(root, "dist");
    await buildPage({ outdir: dist });
    headerLines = (await readFile(join(dist, headersFile), "utf8"))
        .split("\n")
        .filter((l) => l !== "")
        .map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()]);
}, 60_000);

afterEach(async () => {
    await route?.close();
    route = null;
});

afterAll(async () => {
    if (root) await rm(root, { recursive: true, force: true });
});

// A fresh route per test, since a delete or the running end changes what it answers
async function start(liveDelayMs = 2): Promise<FakeRoute> {
    scenarios = makeScenarios(new Date());
    route = await startFakeRoute(dist, scenarios, { liveDelayMs });
    return route;
}

const s = (name: ScenarioName): Scenario => scenarios[name];

function pageHeaders(r: FakeRoute): Record<string, string> {
    return { "Content-Type": "application/json", Origin: r.origin };
}

function call(
    r: FakeRoute,
    path: string,
    body: unknown,
    opts: { method?: string; headers?: Record<string, string> } = {},
): Promise<Response> {
    return fetch(`${r.origin}${path}`, {
        method: opts.method ?? "POST",
        headers: opts.headers ?? pageHeaders(r),
        body: typeof body === "string" ? body : JSON.stringify(body),
    });
}

const ask = (r: FakeRoute, sc: Scenario, key = sc.key) => call(r, `/v1/s/${sc.id}`, { k: key });
const remove = (r: FakeRoute, sc: Scenario) =>
    call(r, `/v1/s/${sc.id}`, { k: sc.key }, { method: "DELETE" });
const watch = (r: FakeRoute, sc: Scenario, seq: number, cursor = "") =>
    call(r, `/v1/s/${sc.id}/jobs/${seq}/live`, { k: sc.key, cursor });

async function events(res: Response): Promise<SseEvent[]> {
    const got: SseEvent[] = [];
    createSseParser((e) => got.push(e)).push(await res.text());
    return got;
}

function expectHeaderLines(res: Response): void {
    for (const [name, value] of headerLines) expect(res.headers.get(name), name).toBe(value);
}

describe("pages and assets", () => {
    it("serves the page for any id of the right shape, with every headers.txt line", async () => {
        const r = await start();
        const res = await fetch(`${r.origin}/s/abcdefghijklmnop`);
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
        expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
        expectHeaderLines(res);
        expect(await res.text()).toBe(await readFile(join(dist, "index.html"), "utf8"));
    });

    it("answers 404 for any other /s/ path, still with the headers", async () => {
        const r = await start();
        for (const path of ["/s/BAD", "/s/ABCDEFGHIJKLMNOP", "/s/abcdefghijklmnop/x", "/s/"]) {
            const res = await fetch(`${r.origin}${path}`);
            expect(res.status, path).toBe(404);
            expectHeaderLines(res);
        }
    });

    it("serves each asset with its type, and nothing outside assets/", async () => {
        const r = await start();
        const types: Record<string, string> = {
            js: "text/javascript; charset=utf-8",
            css: "text/css; charset=utf-8",
            svg: "image/svg+xml",
            woff2: "font/woff2",
        };
        const names = await readdir(join(dist, "assets"));
        expect(names).toHaveLength(7);
        for (const name of names) {
            const res = await fetch(`${r.origin}/assets/${name}`);
            expect(res.status, name).toBe(200);
            expect(res.headers.get("content-type"), name).toBe(types[name.split(".").pop()!]);
            expectHeaderLines(res);
            const bytes = Buffer.from(await res.arrayBuffer());
            expect(bytes.equals(await readFile(join(dist, "assets", name))), name).toBe(true);
        }
        for (const path of ["/assets/missing.js", "/assets/..%2findex.html", "/headers.txt"]) {
            expect((await fetch(`${r.origin}${path}`)).status, path).toBe(404);
        }
    });

    it("tells crawlers to stay out", async () => {
        const r = await start();
        const res = await fetch(`${r.origin}/robots.txt`);
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("User-agent: *\nDisallow: /\n");
        expectHeaderLines(res);
    });
});

describe("the /v1 guard", () => {
    it("refuses a call without the page's own origin, type, site or size", async () => {
        const r = await start();
        const sc = s("ended-full");
        const path = `/v1/s/${sc.id}`;
        const body = { k: sc.key };
        const refused: [string, Response][] = [
            [
                "no origin",
                await call(r, path, body, { headers: { "Content-Type": "application/json" } }),
            ],
            [
                "other origin",
                await call(r, path, body, {
                    headers: { ...pageHeaders(r), Origin: "https://evil.example" },
                }),
            ],
            [
                "text body",
                await call(r, path, body, {
                    headers: { ...pageHeaders(r), "Content-Type": "text/plain" },
                }),
            ],
            [
                "same-site",
                await call(r, path, body, {
                    headers: { ...pageHeaders(r), "Sec-Fetch-Site": "same-site" },
                }),
            ],
            ["over 1 KiB", await call(r, path, { k: sc.key, pad: "x".repeat(1_024) })],
        ];
        for (const [why, res] of refused) {
            expect(res.status, why).toBe(403);
            expectHeaderLines(res);
        }
        const sameOrigin = await call(r, path, body, {
            headers: { ...pageHeaders(r), "Sec-Fetch-Site": "same-origin" },
        });
        expect(sameOrigin.status).toBe(200);
    });

    it("answers a wrong key and an unknown id alike, 404 with no body", async () => {
        const r = await start();
        const sc = s("ended-full");
        const wrong = await ask(r, sc, s("deletable").key);
        const unknown = await call(r, "/v1/s/abcdefghijklmnop", { k: sc.key });
        const garbled = await call(r, `/v1/s/${sc.id}`, "{");
        for (const res of [wrong, unknown, garbled]) {
            expect(res.status).toBe(404);
            expect(await res.text()).toBe("");
            expectHeaderLines(res);
        }
    });

    it("records every request with its method, path, headers and body", async () => {
        const r = await start();
        const sc = s("expired");
        await fetch(`${r.origin}/s/${sc.id}`);
        await ask(r, sc);
        expect(r.requests.map((q) => [q.method, q.path, q.body])).toEqual([
            ["GET", `/s/${sc.id}`, ""],
            ["POST", `/v1/s/${sc.id}`, JSON.stringify({ k: sc.key })],
        ]);
        expect(r.requests[1]?.headers.origin).toBe(r.origin);
    });
});

describe("scenario answers", () => {
    it("sends ended-full's record wrapped as the 200 body", async () => {
        const r = await start();
        const res = await ask(r, s("ended-full"));
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("application/json");
        expectHeaderLines(res);
        const body = await res.json();
        expect(body.state).toBe("ended");
        expect(body.record.v).toBe(1);
        expect(body).toEqual(s("ended-full").gets[0]?.body);
    });

    it("sends running, expired and too-new as they are", async () => {
        const r = await start();
        for (const name of ["running", "expired", "too-new", "ended-hostile"] as const) {
            const res = await ask(r, s(name));
            expect(res.status, name).toBe(200);
            expect(await res.json(), name).toEqual(s(name).gets[0]?.body);
        }
    });

    it("answers pending for ended-pending's first two asks, then the saved output", async () => {
        const r = await start();
        const outputs = [];
        for (let i = 0; i < 4; i++)
            outputs.push((await (await ask(r, s("ended-pending"))).json()).record.output);
        expect(outputs).toEqual(["pending", "pending", "complete", "complete"]);
    });

    it("answers 429 for rate-limited", async () => {
        const r = await start();
        const res = await ask(r, s("rate-limited"));
        expect(res.status).toBe(429);
        expect(await res.text()).toBe("");
    });

    it("deletes deletable with 204, then answers 404 to everything", async () => {
        const r = await start();
        const sc = s("deletable");
        const deleted = await remove(r, sc);
        expect(deleted.status).toBe(204);
        expectHeaderLines(deleted);
        expect((await ask(r, sc)).status).toBe(404);
        expect((await remove(r, sc)).status).toBe(404);
        expect((await ask(r, s("ended-full"))).status).toBe(200);
    });
});

describe("live streams", () => {
    it("streams a finished job's frames with cursors, then exit and end", async () => {
        const r = await start();
        const sc = s("running");
        const script = sc.live[1]!;
        const res = await watch(r, sc, 1);
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("text/event-stream");
        expectHeaderLines(res);
        const got = await events(res);
        expect(got).toEqual([
            ...script.frames.map((f, i) => ({
                event: "out",
                data: JSON.stringify(f),
                id: String(i + 1),
            })),
            { event: "exit", data: JSON.stringify(script.exit), id: null },
            { event: "end", data: JSON.stringify({ reason: "exited" }), id: null },
        ]);
    });

    it("resumes after the cursor it is given", async () => {
        const r = await start();
        const sc = s("running");
        const frames = sc.live[2]!.frames;
        const got = await events(await watch(r, sc, 2, "2"));
        expect(got.filter((e) => e.event === "out").map((e) => [e.id, e.data])).toEqual(
            frames.slice(2).map((f, i) => [String(i + 3), JSON.stringify(f)]),
        );
        expect(got.at(-1)?.event).toBe("end");
    });

    it("ends every stream when the running placement ends, then serves the ended record", async () => {
        const r = await start(5);
        const sc = s("running");
        expect((await (await ask(r, sc)).json()).state).toBe("running");
        const streams = await Promise.all([watch(r, sc, 3), watch(r, sc, 4)]);
        for (const res of streams) {
            const got = await events(res);
            expect(got.some((e) => e.event === "exit")).toBe(false);
            expect(got.filter((e) => e.event === "out").length).toBeGreaterThan(10);
            expect(got.at(-1)).toEqual({
                event: "end",
                data: JSON.stringify({ reason: "ended" }),
                id: null,
            });
        }
        expect(await (await ask(r, sc)).json()).toEqual(s("ended-full").gets[0]?.body);
        expect((await watch(r, sc, 3)).status).toBe(404);
    });

    it("closes a session's streams when it is deleted", async () => {
        const r = await start(20);
        const sc = s("running");
        const res = await watch(r, sc, 4);
        expect(res.status).toBe(200);
        expect((await remove(r, sc)).status).toBe(204);
        const got = await events(res);
        expect(got.at(-1)).toEqual({
            event: "end",
            data: JSON.stringify({ reason: "closed" }),
            id: null,
        });
        expect((await ask(r, sc)).status).toBe(404);
    });

    it("answers 404 for a job with no stream or a session that is not running", async () => {
        const r = await start();
        expect((await watch(r, s("running"), 9)).status).toBe(404);
        expect((await watch(r, s("ended-full"), 1)).status).toBe(404);
        const wrong = await call(r, `/v1/s/${s("running").id}/jobs/1/live`, { k: "bnk_x" });
        expect(wrong.status).toBe(404);
    });
});
