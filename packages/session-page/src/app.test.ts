// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPage, type PageEnv } from "./app.ts";
import { copy } from "./copy.ts";
import type { Scheduler } from "./schedule.ts";
import { makeScenarios, type Scenario } from "./testing/fixtures.ts";

const NOW = new Date("2026-11-06T12:00:00Z");
const HOUR = 3_600_000;
const scenarios = makeScenarios(NOW);

type Answer = { status: number; body: unknown } | "network";

interface Call {
    method: string;
    url: string;
    body: string;
    signal: AbortSignal | null;
}

const encoder = new TextEncoder();

// Each live stream sends `text` at once, then stays open like a quiet stream does
function liveAnswer(live: Answer | string): Response {
    if (live === "network") throw new TypeError("Failed to fetch");
    if (typeof live !== "string") return answer(live);
    const body = new ReadableStream<Uint8Array>({
        start(c) {
            if (live !== "") c.enqueue(encoder.encode(live));
        },
    });
    return { status: 200, ok: true, body } as unknown as Response;
}

function answer(a: Answer): Response {
    if (a === "network") throw new TypeError("Failed to fetch");
    const ok = a.status >= 200 && a.status < 300;
    return { status: a.status, ok, body: null, json: async () => a.body } as unknown as Response;
}

function server(
    gets: Answer[],
    opts: { deletes?: Answer[]; live?: Answer | string } = {},
): { fetch: typeof fetch; calls: Call[]; gets(): Call[]; deletes(): Call[]; lives(): Call[] } {
    const deletes = opts.deletes ?? [{ status: 204, body: null }];
    const calls: Call[] = [];
    let g = 0;
    let d = 0;
    const fetch = (async (url: string, init: RequestInit) => {
        const signal = init.signal ?? null;
        calls.push({ method: String(init.method), url, body: String(init.body), signal });
        if (url.endsWith("/live")) return liveAnswer(opts.live ?? "");
        if (init.method === "DELETE") return answer(deletes[Math.min(d++, deletes.length - 1)]!);
        return answer(gets[Math.min(g++, gets.length - 1)]!);
    }) as unknown as typeof globalThis.fetch;
    const isGet = (c: Call) => c.method === "POST" && !c.url.endsWith("/live");
    return {
        fetch,
        calls,
        gets: () => calls.filter(isGet),
        deletes: () => calls.filter((c) => c.method === "DELETE"),
        lives: () => calls.filter((c) => c.url.endsWith("/live")),
    };
}

const answers = (s: Scenario): Answer[] => s.gets.map((a) => ({ status: a.status, body: a.body }));
const first = (s: Scenario): Answer => answers(s)[0]!;
const pendingBody = first(scenarios["ended-pending"]);

// One frame every 16 ms of fake time, so ticking views never run in a tight loop
function frames(): Scheduler {
    let queue = new Set<() => void>();
    let requested = false;
    return {
        frame(cb) {
            queue.add(cb);
            if (requested) return;
            requested = true;
            setTimeout(() => {
                requested = false;
                const batch = queue;
                queue = new Set();
                for (const run of batch) run();
            }, 16);
        },
    };
}

const pages: { destroy(): void }[] = [];

interface Opened {
    app: HTMLElement;
    replaced: string[];
    clipboard: { writeText: ReturnType<typeof vi.fn> };
}

function open(
    opts: {
        scenario?: Scenario;
        path?: string;
        hash?: string;
        fetch?: typeof fetch;
        now?: () => Date;
    } = {},
): Opened {
    const scenario = opts.scenario ?? scenarios["ended-full"];
    const app = document.createElement("main");
    app.id = "app";
    document.body.replaceChildren(app);
    const replaced: string[] = [];
    const clipboard = { writeText: vi.fn(async (_text: string) => {}) };
    const env: PageEnv = {
        doc: document,
        location: {
            pathname: opts.path ?? `/s/${scenario.id}`,
            hash: opts.hash ?? `#k=${scenario.key}`,
        },
        replacePath: (path) => void replaced.push(path),
        storage: window.sessionStorage,
        fetch: opts.fetch ?? server([]).fetch,
        now: opts.now ?? (() => new Date()),
        clipboard,
        scheduler: frames(),
        setTimer: (cb, ms) => setTimeout(cb, ms) as unknown as number,
        clearTimer: (id) => clearTimeout(id),
    };
    pages.push(startPage(env));
    return { app, replaced, clipboard };
}

const settle = async () => {
    for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(0);
};
const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

const q = <T extends Element = HTMLElement>(app: HTMLElement, sel: string) =>
    app.querySelector<T>(sel);
const text = (app: HTMLElement, sel: string) => q(app, sel)?.textContent ?? null;
const message = (app: HTMLElement) => text(app, ".message");
const status = (app: HTMLElement) => text(app, ".session-state");
const rows = (app: HTMLElement) => app.querySelectorAll("tr.cmd-row").length;
const button = (app: HTMLElement, sel: string) => q<HTMLButtonElement>(app, sel)!;
const stored = (s: Scenario) => window.sessionStorage.getItem(`bugnet.session.${s.id}`);

beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ["setTimeout", "clearTimeout", "Date"] });
    window.sessionStorage.clear();
});

afterEach(() => {
    for (const page of pages.splice(0)) page.destroy();
    vi.useRealTimers();
    window.sessionStorage.clear();
});

describe("the link", () => {
    it("asks once at open, with the heading alone until the answer comes", async () => {
        const s = scenarios["ended-full"];
        let answerNow: (r: Response) => void = () => {};
        const calls: string[] = [];
        const held = (async (url: string) => {
            calls.push(url);
            return new Promise<Response>((resolve) => (answerNow = resolve));
        }) as unknown as typeof fetch;
        const { app, replaced } = open({ scenario: s, fetch: held });
        expect(calls).toEqual([`/v1/s/${s.id}`]);
        expect(replaced).toEqual([`/s/${s.id}`]);
        const head = q(app, ".session-head");
        expect([...app.children]).toEqual([head]);
        expect(text(app, "h1")).toBe(copy.heading);
        expect(q(app, ".session-state")?.hidden).toBe(true);
        expect(q(app, ".tip")).toBeNull();
        expect(q(app, "button")).toBeNull();
        await advance(60_000);
        expect(calls).toHaveLength(1);
        answerNow(answer(first(s)));
        await settle();
        expect(app.firstElementChild).toBe(head);
        expect(rows(app)).toBe(6);
    });

    it("says a link without a key is missing it, and asks nothing", async () => {
        const srv = server([first(scenarios["ended-full"])]);
        const { app } = open({ hash: "", fetch: srv.fetch });
        expect(message(app)).toBe(copy.noKey);
        await advance(60_000);
        expect(srv.calls).toEqual([]);
    });

    it("says a path that is not a session link is not one, and asks nothing", async () => {
        const srv = server([first(scenarios["ended-full"])]);
        const { app } = open({ path: "/s/NOT-A-LINK", fetch: srv.fetch });
        expect(message(app)).toBe(copy.notALink);
        await advance(60_000);
        expect(srv.calls).toEqual([]);
    });

    it("never puts the key in the page text or in a URL", async () => {
        const s = scenarios["ended-full"];
        const srv = server([first(s)]);
        const { app } = open({ scenario: s, fetch: srv.fetch });
        await settle();
        expect(srv.gets()).toHaveLength(1);
        for (const node of app.querySelectorAll<SVGGElement>("g.map-node")) {
            node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        }
        expect(document.body.textContent).not.toContain(s.key);
        expect(srv.calls.length).toBeGreaterThan(0);
        for (const call of srv.calls) {
            expect(call.url).not.toContain(s.key);
            expect(JSON.parse(call.body)).toEqual({ k: s.key });
        }
    });
});

describe("an ended session", () => {
    it("shows the map, six commands and the map's caption", async () => {
        const srv = server([first(scenarios["ended-full"])]);
        const { app } = open({ fetch: srv.fetch });
        await settle();
        expect(q(app, ".map[data-edge] svg.map-svg")).not.toBeNull();
        expect(q(app, ".map[data-edge] ul.map-list")).not.toBeNull();
        expect(rows(app)).toBe(6);
        expect(text(app, ".map-caption")).toBe(copy.notSeen);
        expect(status(app)).toBe(copy.ended("stopped"));
        const times = [...app.querySelectorAll(".session-times > span")].map((p) => p.textContent);
        expect(times).toHaveLength(3);
        expect(times[0]).toMatch(/^Started /);
        expect(times[1]).toMatch(/^Ended /);
        expect(times[2]).toMatch(/^Deleted in /);
        expect(status(app)).toBe("Ended: stopped");
        expect(q(app, "table.commands")?.hasAttribute("data-edge")).toBe(true);
        expect(document.activeElement).toBe(q(app, "h1"));
    });

    it("says how many events were not recorded", async () => {
        const srv = server([first(scenarios["ended-crowded"])]);
        const { app } = open({ scenario: scenarios["ended-crowded"], fetch: srv.fetch });
        await settle();
        const caption = [...app.querySelectorAll(".map-caption p")].map((p) => p.textContent);
        expect(caption).toEqual([copy.notSeen, copy.eventsDropped(120)]);
    });

    it("opens a bubble's events, and closes them on a second click or Escape", async () => {
        const srv = server([first(scenarios["ended-full"])]);
        const { app } = open({ fetch: srv.fetch });
        await settle();
        const bubble = () => q<SVGGElement>(app, 'g.map-node[data-node-id="payments"]')!;
        const table = () => q(app, '.map-table .table-scroll[data-node-id="payments"]');
        bubble().dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(table()).not.toBeNull();
        expect(bubble().classList.contains("is-selected")).toBe(true);
        expect(q(app, '.map-row.is-selected[data-node-id="payments"]')).not.toBeNull();
        bubble().dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(table()).toBeNull();

        bubble().focus();
        bubble().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        expect(table()).not.toBeNull();
        expect(document.activeElement).toBe(bubble());
        bubble().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        expect(table()).toBeNull();
        expect(document.activeElement).toBe(bubble());
    });

    it("lays the map out at its container's width, and again when that width changes", async () => {
        const observers: FakeObserver[] = [];
        class FakeObserver {
            observed: Element[] = [];
            disconnected = false;
            constructor(readonly fire: () => void) {
                observers.push(this);
            }
            observe(target: Element) {
                this.observed.push(target);
            }
            disconnect() {
                this.disconnected = true;
            }
        }
        const win = document.defaultView as unknown as Record<string, unknown>;
        win.ResizeObserver = FakeObserver;
        try {
            const srv = server([first(scenarios["ended-full"])]);
            const { app } = open({ fetch: srv.fetch });
            await settle();
            const drawnWidth = () => q(app, "svg.map-svg")?.getAttribute("viewBox")?.split(" ")[2];
            expect(drawnWidth()).toBe("720");
            const [observer] = observers;
            const ruler = observer!.observed[0] as HTMLElement;
            expect(q(app, ".map")?.contains(ruler)).toBe(true);
            let width = 1152;
            Object.defineProperty(ruler, "clientWidth", { get: () => width });
            observer!.fire();
            expect(drawnWidth()).toBe("1152");
            const drawn = q(app, "svg.map-svg");
            observer!.fire();
            expect(q(app, "svg.map-svg")).toBe(drawn);
            width = 900;
            observer!.fire();
            expect(drawnWidth()).toBe("900");
            pages.pop()!.destroy();
            expect(observer!.disconnected).toBe(true);
        } finally {
            delete win.ResizeObserver;
        }
    });

    it("opens the same events from the phone list", async () => {
        const srv = server([first(scenarios["ended-full"])]);
        const { app } = open({ fetch: srv.fetch });
        await settle();
        const row = () => q<HTMLButtonElement>(app, 'button.map-row[data-node-id="mcp"]')!;
        row().click();
        expect(q(app, '.map-table .table-scroll[data-node-id="mcp"]')).not.toBeNull();
        expect(row().getAttribute("aria-pressed")).toBe("true");
        row().click();
        expect(q(app, ".map-table .table-scroll")).toBeNull();
    });

    it("asks again at 5 s and 10 s while output is saved, then shows the commands", async () => {
        const srv = server(answers(scenarios["ended-pending"]));
        const { app } = open({ scenario: scenarios["ended-pending"], fetch: srv.fetch });
        await settle();
        expect(text(app, ".commands-note")).toBe(copy.savingOutput);
        expect(q(app, "table.commands")?.hidden).toBe(true);
        await advance(4_999);
        expect(srv.gets()).toHaveLength(1);
        await advance(1);
        expect(srv.gets()).toHaveLength(2);
        await advance(5_000);
        expect(srv.gets()).toHaveLength(3);
        expect(q(app, "table.commands")?.hidden).toBe(false);
        expect(q(app, ".commands-note")?.hidden).toBe(true);
        expect(rows(app)).toBeGreaterThan(0);
        await advance(120_000);
        expect(srv.gets()).toHaveLength(3);
    });

    it("asks every 5 s for two minutes, then every 30 s", async () => {
        const srv = server([pendingBody]);
        open({ scenario: scenarios["ended-pending"], fetch: srv.fetch });
        await settle();
        for (let ask = 1; ask <= 24; ask++) {
            await advance(5_000);
            expect(srv.gets()).toHaveLength(1 + ask);
        }
        await advance(29_999);
        expect(srv.gets()).toHaveLength(25);
        await advance(1);
        expect(srv.gets()).toHaveLength(26);
        await advance(30_000);
        expect(srv.gets()).toHaveLength(27);
    });
});

describe("a running session", () => {
    const running = scenarios.running;
    const runningBody = first(running);

    it("counts time left from the snapshot's clock, not the viewer's", async () => {
        const srv = server([runningBody]);
        const { app } = open({
            scenario: running,
            fetch: srv.fetch,
            now: () => new Date(Date.now() - 3 * HOUR),
        });
        await settle();
        expect(status(app)).toBe(copy.running);
        expect(q(app, ".session-state .dot")).not.toBeNull();
        expect(text(app, ".session-times")).toContain("(7 min left)");
        const timeCell = q(app, 'tr.cmd-row[data-seq="4"] td.col-wide');
        expect(timeCell?.textContent).toBe("30\u00a0s");
        expect(text(app, ".map-later")).toBe(copy.mapLater);
        expect(rows(app)).toBe(4);
    });

    it("asks again every 10 s", async () => {
        const srv = server([runningBody]);
        open({ scenario: running, fetch: srv.fetch });
        await settle();
        await advance(9_999);
        expect(srv.gets()).toHaveLength(1);
        await advance(1);
        expect(srv.gets()).toHaveLength(2);
        await advance(10_000);
        expect(srv.gets()).toHaveLength(3);
    });

    it("streams the open command and the running ones, newest first", async () => {
        const srv = server([runningBody]);
        const { app } = open({ scenario: running, fetch: srv.fetch });
        await settle();
        expect(srv.lives().map((c) => c.url)).toEqual([
            `/v1/s/${running.id}/jobs/4/live`,
            `/v1/s/${running.id}/jobs/3/live`,
        ]);
        button(app, 'tr.cmd-row[data-seq="1"] button.cmd-toggle').click();
        await settle();
        expect(srv.lives().at(-1)?.url).toBe(`/v1/s/${running.id}/jobs/1/live`);
    });

    it("shows the record when a later answer says the sandbox ended", async () => {
        const srv = server([runningBody, first(scenarios["ended-full"])]);
        const { app } = open({ scenario: running, fetch: srv.fetch });
        await settle();
        expect(q(app, ".map")).toBeNull();
        await advance(10_000);
        await settle();
        expect(q(app, ".map svg.map-svg")).not.toBeNull();
        expect(q(app, ".map-later")).toBeNull();
        expect(status(app)).toBe(copy.sandboxEnded);
        expect(rows(app)).toBe(6);
        expect(srv.lives().length).toBeGreaterThan(0);
        expect(srv.lives().every((c) => c.signal?.aborted)).toBe(true);
        const livesBefore = srv.lives().length;
        await advance(60_000);
        expect(srv.gets()).toHaveLength(2);
        expect(srv.lives()).toHaveLength(livesBefore);
    });

    it("loads the record when a stream says the sandbox ended", async () => {
        const srv = server([runningBody, first(scenarios["ended-full"])], {
            live: 'event: end\ndata: {"reason":"ended"}\n\n',
        });
        const { app } = open({ scenario: running, fetch: srv.fetch });
        await settle();
        await settle();
        expect(srv.gets()).toHaveLength(2);
        expect(status(app)).toBe(copy.sandboxEnded);
        expect(q(app, ".map svg.map-svg")).not.toBeNull();
    });

    it("says it is reconnecting after three failed asks, and keeps the view", async () => {
        const srv = server([runningBody, "network", "network", "network", runningBody]);
        const { app } = open({ scenario: running, fetch: srv.fetch });
        await settle();
        await advance(20_000);
        expect(status(app)).toBe(copy.running);
        await advance(10_000);
        expect(status(app)).toBe(copy.reconnecting);
        expect(rows(app)).toBe(4);
        await advance(10_000);
        expect(status(app)).toBe(copy.running);
    });

    it("clears the view when a later answer says the link is gone", async () => {
        const srv = server([runningBody, { status: 404, body: null }]);
        const { app } = open({ scenario: running, fetch: srv.fetch });
        await settle();
        await advance(10_000);
        expect(message(app)).toBe(copy.notFound);
        expect(rows(app)).toBe(0);
        expect(stored(running)).toBeNull();
        expect(document.activeElement).toBe(q(app, ".message"));
        await advance(60_000);
        expect(srv.gets()).toHaveLength(2);
    });

    it("shows the not-found line when a stream answers 404", async () => {
        const srv = server([runningBody], { live: { status: 404, body: null } });
        const { app } = open({ scenario: running, fetch: srv.fetch });
        await settle();
        expect(message(app)).toBe(copy.notFound);
        expect(stored(running)).toBeNull();
    });
});

describe("the end states", () => {
    it("forgets the key when the page has expired", async () => {
        const s = scenarios.expired;
        const srv = server([first(s)]);
        const { app } = open({ scenario: s, fetch: srv.fetch });
        expect(stored(s)).toBe(s.key);
        await settle();
        expect(message(app)).toBe(copy.expired);
        expect(stored(s)).toBeNull();
        expect(document.activeElement).toBe(q(app, ".message"));
    });

    it("forgets the key when the link is not found", async () => {
        const s = scenarios["ended-full"];
        const srv = server([{ status: 404, body: null }]);
        const { app } = open({ scenario: s, fetch: srv.fetch });
        await settle();
        expect(message(app)).toBe(copy.notFound);
        expect(stored(s)).toBeNull();
    });

    it("offers a retry after a 429, and a retry asks again once", async () => {
        const s = scenarios["rate-limited"];
        const srv = server([{ status: 429, body: null }, first(scenarios["ended-full"])]);
        const { app } = open({ scenario: s, fetch: srv.fetch });
        await settle();
        expect(message(app)).toBe(copy.rateLimited);
        const retry = button(app, "button.retry");
        expect(retry.textContent).toBe(copy.retry);
        retry.click();
        retry.click();
        await settle();
        expect(srv.gets()).toHaveLength(2);
        expect(rows(app)).toBe(6);
    });

    it("offers a retry when Bugnet cannot be reached", async () => {
        const srv = server(["network"]);
        const { app } = open({ fetch: srv.fetch });
        await settle();
        expect(message(app)).toBe(copy.offline);
        expect(q(app, "button.retry")).not.toBeNull();
    });

    it("asks for a reload when the payload is too new or unreadable", async () => {
        const tooNew = server([first(scenarios["too-new"])]);
        const a = open({ scenario: scenarios["too-new"], fetch: tooNew.fetch });
        await settle();
        expect(message(a.app)).toBe(copy.tooNew);

        const broken = server([{ status: 200, body: { state: "ended", record: {} } }]);
        const b = open({ fetch: broken.fetch });
        await settle();
        expect(message(b.app)).toBe(copy.tooNew);
    });
});

describe("Delete now", () => {
    const s = scenarios.deletable;

    it("asks once, sends one DELETE for a double click, then says it is deleted", async () => {
        const srv = server([first(s)]);
        const { app } = open({ scenario: s, fetch: srv.fetch });
        await settle();
        button(app, "button.delete-now").click();
        expect(text(app, ".confirm-text")).toBe(copy.confirmDelete);
        const confirm = button(app, "button.confirm-delete");
        confirm.click();
        confirm.click();
        await settle();
        expect(srv.deletes()).toHaveLength(1);
        expect(message(app)).toBe(copy.deleted);
        expect(stored(s)).toBeNull();
        expect(document.activeElement).toBe(q(app, ".message"));
    });

    it("goes back to Delete now on Cancel", async () => {
        const srv = server([first(s)]);
        const { app } = open({ scenario: s, fetch: srv.fetch });
        await settle();
        button(app, "button.delete-now").click();
        expect(q(app, "button.delete-now")?.hidden).toBe(true);
        button(app, "button.cancel-delete").click();
        expect(q(app, "button.delete-now")?.hidden).toBe(false);
        expect(q(app, ".confirm")?.hidden).toBe(true);
        expect(srv.deletes()).toHaveLength(0);
    });

    it("says a failed delete failed, and lets the reader try again", async () => {
        const srv = server([first(s)], {
            deletes: [
                { status: 500, body: null },
                { status: 204, body: null },
            ],
        });
        const { app } = open({ scenario: s, fetch: srv.fetch });
        await settle();
        button(app, "button.delete-now").click();
        const confirm = button(app, "button.confirm-delete");
        confirm.click();
        await settle();
        expect(text(app, ".confirm-text")).toBe(copy.deleteFailed);
        expect(confirm.disabled).toBe(false);
        confirm.click();
        await settle();
        expect(srv.deletes()).toHaveLength(2);
        expect(message(app)).toBe(copy.deleted);
    });

    it("shows the not-found line when the session was already gone", async () => {
        const srv = server([first(s)], { deletes: [{ status: 404, body: null }] });
        const { app } = open({ scenario: s, fetch: srv.fetch });
        await settle();
        button(app, "button.delete-now").click();
        button(app, "button.confirm-delete").click();
        await settle();
        expect(message(app)).toBe(copy.notFound);
    });

    it("stops the live streams once deleted", async () => {
        const running = scenarios.running;
        const srv = server([first(running)]);
        const { app } = open({ scenario: running, fetch: srv.fetch });
        await settle();
        button(app, "button.delete-now").click();
        button(app, "button.confirm-delete").click();
        await settle();
        expect(message(app)).toBe(copy.deleted);
        expect(srv.lives().every((c) => c.signal?.aborted)).toBe(true);
        const asked = srv.calls.length;
        await advance(60_000);
        expect(srv.calls).toHaveLength(asked);
    });
});
