import { describe, expect, it } from "vitest";
import { createApi } from "./api.ts";
import { makeScenarios } from "./testing/fixtures.ts";

const KEY = "k".repeat(43);

interface Call {
    url: string;
    init: RequestInit;
}

function fake(respond: () => Response | Error): { fetch: typeof fetch; calls: Call[] } {
    const calls: Call[] = [];
    const f = (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        const r = respond();
        if (r instanceof Error) throw r;
        return r;
    }) as unknown as typeof fetch;
    return { fetch: f, calls };
}

function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status });
}

const validBody = makeScenarios(new Date("2026-11-06T12:00:00Z"))["ended-full"].gets[0]!.body;

describe("requests", () => {
    it("get() POSTs the key in the body with the hardened options", async () => {
        const f = fake(() => json(200, validBody));
        await createApi({ fetch: f.fetch, id: "abc", key: KEY }).get();
        const { url, init } = f.calls[0]!;
        expect(url).toBe("/v1/s/abc");
        expect(init.method).toBe("POST");
        expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
        expect(init.body).toBe(JSON.stringify({ k: KEY }));
        expect(init.referrerPolicy).toBe("strict-origin");
        expect(init.credentials).toBe("omit");
        expect(init.cache).toBe("no-store");
        expect(init.redirect).toBe("error");
    });

    it("remove() sends a DELETE with the same body", async () => {
        const f = fake(() => new Response(null, { status: 204 }));
        const r = await createApi({ fetch: f.fetch, id: "abc", key: KEY }).remove();
        expect(r).toEqual({ ok: true });
        expect(f.calls[0]!.init.method).toBe("DELETE");
        expect(f.calls[0]!.url).toBe("/v1/s/abc");
        expect(f.calls[0]!.init.body).toBe(JSON.stringify({ k: KEY }));
        expect(f.calls[0]!.init.redirect).toBe("error");
    });

    it("live() POSTs the cursor and asks for an event stream", async () => {
        const f = fake(() => new Response("", { status: 200 }));
        const api = createApi({ fetch: f.fetch, id: "abc", key: KEY });
        const ac = new AbortController();
        await api.live(3, "c1", ac.signal);
        await api.live(4, null, ac.signal);
        expect(f.calls[0]!.url).toBe("/v1/s/abc/jobs/3/live");
        expect(f.calls[0]!.init.method).toBe("POST");
        expect(f.calls[0]!.init.body).toBe(JSON.stringify({ k: KEY, cursor: "c1" }));
        expect(f.calls[0]!.init.headers).toMatchObject({ Accept: "text/event-stream" });
        expect(f.calls[0]!.init.signal).toBe(ac.signal);
        expect(f.calls[1]!.init.body).toBe(JSON.stringify({ k: KEY, cursor: "" }));
    });

    it("never puts the key in a URL", async () => {
        const f = fake(() => json(200, validBody));
        const api = createApi({ fetch: f.fetch, id: "abc", key: KEY });
        await api.get();
        await api.remove();
        await api.live(1, "c", new AbortController().signal);
        expect(f.calls).toHaveLength(3);
        for (const c of f.calls) expect(c.url).not.toContain(KEY);
    });
});

describe("status mapping", () => {
    const get = (r: () => Response | Error) =>
        createApi({ fetch: fake(r).fetch, id: "abc", key: KEY }).get();

    it("maps a valid 200 to ok", async () => {
        const r = await get(() => json(200, validBody));
        expect(r.ok && r.body.state).toBe("ended");
    });

    it("maps a bad 200 body to bad-payload", async () => {
        expect(await get(() => json(200, { state: "ended", record: { v: 1 } }))).toEqual({
            ok: false,
            error: "bad-payload",
        });
        expect(await get(() => new Response("not json", { status: 200 }))).toEqual({
            ok: false,
            error: "bad-payload",
        });
    });

    it.each([
        [404, "not-found"],
        [429, "rate-limited"],
        [500, "offline"],
        [403, "offline"],
    ])("maps %i to %s", async (status, error) => {
        expect(await get(() => json(status, {}))).toEqual({ ok: false, error });
    });

    it("maps a thrown TypeError to offline", async () => {
        expect(await get(() => new TypeError("failed"))).toEqual({ ok: false, error: "offline" });
    });

    it("maps remove() failures", async () => {
        const rm = (r: () => Response | Error) =>
            createApi({ fetch: fake(r).fetch, id: "abc", key: KEY }).remove();
        expect(await rm(() => json(404, {}))).toEqual({ ok: false, error: "not-found" });
        expect(await rm(() => json(429, {}))).toEqual({ ok: false, error: "rate-limited" });
        expect(await rm(() => new TypeError("x"))).toEqual({ ok: false, error: "offline" });
    });

    describe("live()", () => {
        const live = (r: () => Response | Error) =>
            createApi({ fetch: fake(r).fetch, id: "abc", key: KEY }).live(
                1,
                null,
                new AbortController().signal,
            );

        it("returns the response only for 200", async () => {
            expect(await live(() => new Response("", { status: 200 }))).toBeInstanceOf(Response);
        });

        it.each([
            [404, "not-found"],
            [429, "rate-limited"],
            [500, "offline"],
            [204, "offline"],
        ])("maps %i to %s", async (status, error) => {
            expect(await live(() => new Response(null, { status }))).toBe(error);
        });

        it("maps a thrown error to offline", async () => {
            expect(await live(() => new TypeError("failed"))).toBe("offline");
        });
    });
});
