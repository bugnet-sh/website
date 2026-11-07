// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPage, type PageEnv } from "./app.ts";
import { copy } from "./copy.ts";
import { formatClock } from "./format.ts";
import { createSessionHead } from "./render/session.ts";
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
// The one label of a button that holds several and shows one
const shownLabel = (b: HTMLElement) =>
    [...b.children].find((c) => c.getAttribute("aria-hidden") !== "true")?.textContent ?? null;
const stored = (s: Scenario) => window.sessionStorage.getItem(`bugnet.session.${s.id}`);

interface Ended {
    deletesAt: string;
    output: string;
    events: unknown[];
}

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

describe("the session row", () => {
    it("focuses the heading without scrolling on every change of state", async () => {
        const srv = server([first(scenarios.running), first(scenarios["ended-full"])]);
        const calls: unknown[] = [];
        const focus = vi.spyOn(HTMLHeadingElement.prototype, "focus").mockImplementation(function (
            this: HTMLElement,
            opts?: FocusOptions,
        ) {
            calls.push(opts);
        });
        try {
            open({ scenario: scenarios.running, fetch: srv.fetch });
            await settle();
            await advance(10_000);
            await settle();
            expect(calls).toEqual([{ preventScroll: true }, { preventScroll: true }]);
        } finally {
            focus.mockRestore();
        }
    });

    it("repaints the times on each minute while a view shows, and not before", async () => {
        const full = first(scenarios["ended-full"]) as {
            status: number;
            body: { record: { deletesAt: string } };
        };
        const soon = structuredClone(full);
        // 1 h 30 min left at open, 1 h 29 min a minute later
        const deletesAt = new Date(NOW.getTime() + 90 * 60_000);
        soon.body.record.deletesAt = deletesAt.toISOString();
        const srv = server([soon]);
        const { app } = open({ fetch: srv.fetch });
        await settle();
        const deletes = () => app.querySelectorAll(".session-times > span")[2]?.textContent;
        const at = formatClock(deletesAt, NOW);
        expect(deletes()).toBe(copy.deletes(at, "1 h 30 min"));
        await advance(59_999);
        expect(deletes()).toBe(copy.deletes(at, "1 h 30 min"));
        await advance(1);
        expect(deletes()).toBe(copy.deletes(at, "1 h 29 min"));
        expect(srv.gets()).toHaveLength(1);
    });

    it("stops every timer once the page reaches a final state", async () => {
        const running = scenarios.running;
        const srv = server([first(running), { status: 404, body: null }]);
        const { app } = open({ scenario: running, fetch: srv.fetch });
        await settle();
        await advance(10_000);
        expect(message(app)).toBe(copy.notFound);
        await advance(1_000);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("keeps the status current after a page translation replaced its words", () => {
        const head = createSessionHead(document);
        document.body.replaceChildren(head.root);
        head.setStatus(copy.running, true);
        const label = head.root.querySelector(".session-state .state-label")!;
        expect(label.textContent).toBe(copy.running);
        // What a browser's translation does: the text node goes, a font element takes its place
        const font = document.createElement("font");
        font.textContent = "[tr] Running";
        label.replaceChildren(font);
        head.setStatus(copy.reconnecting, false);
        expect(head.root.querySelector(".session-state")!.textContent).toBe(copy.reconnecting);
        head.setStatus(copy.ended("stopped"), false);
        expect(head.root.querySelector(".session-state")!.textContent).toBe(copy.ended("stopped"));
        // The words the page last set, not what the page now holds, decide a change
        label.replaceChildren(font);
        head.setStatus(copy.ended("stopped"), false);
        expect(label.textContent).toBe("[tr] Running");
    });

    it("marks the status line as sharing the page's left edge", async () => {
        const srv = server([first(scenarios["ended-full"])]);
        const { app } = open({ fetch: srv.fetch });
        await settle();
        expect(q(app, ".session-state")?.hasAttribute("data-edge")).toBe(true);
        expect(q(app, ".commands-note")?.hasAttribute("data-edge")).toBe(true);
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
        const record = (first(scenarios["ended-full"]) as { body: { record: Ended } }).body.record;
        const deletesAt = new Date(record.deletesAt);
        // Two days after the start, so the deletion time carries its date
        expect(times[2]).toBe(copy.deletes(formatClock(deletesAt, NOW), "47 h"));
        expect(times[2]).toMatch(/^Deleted at \d+ [A-Z][a-z]{2} \d\d:\d\d \(in 47 h\)$/);
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

    it("closes an open table on Escape from inside it, and goes back to its bubble", async () => {
        const srv = server([first(scenarios["ended-full"])]);
        const { app } = open({ fetch: srv.fetch });
        await settle();
        const bubble = () => q<SVGGElement>(app, 'g.map-node[data-node-id="payments"]')!;
        const holder = q(app, ".map-table")!;
        expect(holder.id).not.toBe("");
        expect(bubble().getAttribute("aria-controls")).toBe(holder.id);
        expect(q(app, "button.map-row")!.getAttribute("aria-controls")).toBe(holder.id);
        bubble().dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(bubble().getAttribute("aria-expanded")).toBe("true");
        const link = q<HTMLAnchorElement>(app, ".map-table a.tx-link")!;
        link.focus();
        link.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        expect(q(app, ".map-table .table-scroll")).toBeNull();
        expect(bubble().getAttribute("aria-expanded")).toBe("false");
        expect(document.activeElement).toBe(bubble());
        // Escape with nothing open does nothing
        holder.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
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

    it("cuts a map name the fonts draw too wide when drawn, and again once the fonts are in", async () => {
        let fontsIn: () => void = () => {};
        const ready = new Promise<void>((resolve) => (fontsIn = resolve));
        Object.defineProperty(document, "fonts", { configurable: true, value: { ready } });
        let perChar = 7;
        const proto = window.SVGElement.prototype as unknown as Record<string, unknown>;
        proto.getComputedTextLength = function (this: Element) {
            return Array.from(this.textContent ?? "").length * perChar;
        };
        try {
            const srv = server([first(scenarios["ended-full"])]);
            const { app } = open({ fetch: srv.fetch });
            await settle();
            const name = () => q(app, 'g.map-node[data-node-id="mcp"] tspan.map-name')!;
            expect(name().textContent).toBe("Bugnet MCP");
            perChar = 30;
            fontsIn();
            await settle();
            expect(name().textContent).toMatch(/^Bu.*…$/);
            perChar = 7;
            q<SVGGElement>(app, 'g.map-node[data-node-id="payments"]')!.dispatchEvent(
                new MouseEvent("click", { bubbles: true }),
            );
            expect(name().textContent).toBe("Bugnet MCP");
        } finally {
            delete proto.getComputedTextLength;
            delete (document as unknown as Record<string, unknown>).fonts;
        }
    });

    it("opens the same events from the phone list", async () => {
        const srv = server([first(scenarios["ended-full"])]);
        const { app } = open({ fetch: srv.fetch });
        await settle();
        const row = () => q<HTMLButtonElement>(app, 'button.map-row[data-node-id="mcp"]')!;
        row().click();
        expect(q(app, '.map-table .table-scroll[data-node-id="mcp"]')).not.toBeNull();
        expect(row().getAttribute("aria-expanded")).toBe("true");
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

    it("rebuilds the map from each later answer, keeping the open bubble", async () => {
        type Body = { record: { output: string; events: unknown[] } };
        const full = first(scenarios["ended-full"]) as { status: number; body: Body };
        const saving = structuredClone(full);
        saving.body.record.output = "pending";
        const later = structuredClone(full);
        const at = new Date(NOW.getTime() - 60_000).toISOString();
        later.body.record.events.push({
            at,
            kind: "secret_host",
            host: "late.example",
            requests: 2,
            bytes: 10,
        });
        const srv = server([saving, later]);
        const { app } = open({ fetch: srv.fetch });
        await settle();
        const late = 'g.map-node[data-node-id="secret-host:late.example"]';
        expect(q(app, late)).toBeNull();
        const payments = () => q<SVGGElement>(app, 'g.map-node[data-node-id="payments"]')!;
        payments().dispatchEvent(new MouseEvent("click", { bubbles: true }));
        const table = () => q(app, '.map-table .table-scroll[data-node-id="payments"]');
        const opened = table();
        await advance(5_000);
        expect(srv.gets()).toHaveLength(2);
        expect(q(app, late)).not.toBeNull();
        expect(q(app, '.map-row[data-node-id="secret-host:late.example"]')).not.toBeNull();
        expect(payments().classList.contains("is-selected")).toBe(true);
        // Its rows did not change, so the reader's place in the open table stays
        expect(table()).toBe(opened);
        expect(app.querySelectorAll(".map")).toHaveLength(1);
    });

    it("keeps focus on the same control when the open table's rows change", async () => {
        type Body = { record: { output: string; events: unknown[] } };
        const full = first(scenarios["ended-full"]) as { status: number; body: Body };
        const saving = structuredClone(full);
        saving.body.record.output = "pending";
        const later = structuredClone(full);
        later.body.record.events.push({
            at: new Date(NOW.getTime() - 60_000).toISOString(),
            kind: "payment",
            payKind: "extend",
            amountMicros: 10_000,
            tx: "not-a-signature",
        });
        const srv = server([saving, later]);
        const { app } = open({ fetch: srv.fetch });
        await settle();
        q<SVGGElement>(app, 'g.map-node[data-node-id="payments"]')!.dispatchEvent(
            new MouseEvent("click", { bubbles: true }),
        );
        const table = () => q(app, '.map-table .table-scroll[data-node-id="payments"]')!;
        const before = table();
        const rowsBefore = before.querySelectorAll("tbody tr").length;
        const focused = before.querySelectorAll<HTMLButtonElement>("button.copy-button")[1]!;
        const rowText = focused.closest("tr")!.textContent;
        focused.focus();
        await advance(5_000);
        expect(srv.gets()).toHaveLength(2);
        expect(table()).not.toBe(before);
        expect(table().querySelectorAll("tbody tr")).toHaveLength(rowsBefore + 1);
        const now = document.activeElement as HTMLElement;
        expect(table().contains(now)).toBe(true);
        expect(now.matches("button.copy-button")).toBe(true);
        expect(now.closest("tr")!.textContent).toBe(rowText);
    });

    it("still shows the status, the times and the commands when the map fails to draw", async () => {
        class Broken {
            observe() {
                throw new Error("map failed");
            }
            disconnect() {}
        }
        const win = document.defaultView as unknown as Record<string, unknown>;
        win.ResizeObserver = Broken;
        const reported = vi.fn();
        vi.stubGlobal("reportError", reported);
        try {
            const srv = server([first(scenarios["ended-full"])]);
            const { app } = open({ fetch: srv.fetch });
            await settle();
            expect(reported).toHaveBeenCalledOnce();
            expect((reported.mock.calls[0]![0] as Error).message).toBe("map failed");
            expect(status(app)).toBe(copy.ended("stopped"));
            expect(app.querySelectorAll(".session-times > span")).toHaveLength(3);
            expect(rows(app)).toBe(6);
            expect(q(app, ".map-section svg")).toBeNull();
            expect(text(app, ".map-section .map-caption")).toBe(copy.notSeen);
            expect(app.querySelectorAll(".map-section")).toHaveLength(1);
        } finally {
            delete win.ResizeObserver;
            vi.unstubAllGlobals();
        }
    });

    it("tries the map again on each record, and keeps the empty map's caption current", async () => {
        class Broken {
            observe() {
                throw new Error("map failed");
            }
            disconnect() {}
        }
        const win = document.defaultView as unknown as Record<string, unknown>;
        win.ResizeObserver = Broken;
        const reported = vi.fn();
        vi.stubGlobal("reportError", reported);
        try {
            const body = pendingBody.body as { record: Record<string, unknown> };
            const later: Answer = {
                status: 200,
                body: { ...body, record: { ...body.record, eventsDropped: 120 } },
            };
            const srv = server([pendingBody, later]);
            const { app } = open({ scenario: scenarios["ended-pending"], fetch: srv.fetch });
            await settle();
            expect(reported).toHaveBeenCalledTimes(1);
            expect(app.querySelectorAll(".map-caption p")).toHaveLength(1);
            await advance(5_000);
            expect(reported).toHaveBeenCalledTimes(2);
            expect(app.querySelectorAll(".map-section")).toHaveLength(1);
            expect(text(app, ".map-section .map-caption")).toContain(copy.eventsDropped(120));
        } finally {
            delete win.ResizeObserver;
            vi.unstubAllGlobals();
        }
    });

    it("asks again at the usual pace when drawing an answer throws after the view is up", async () => {
        const reported = vi.fn();
        vi.stubGlobal("reportError", reported);
        try {
            const srv = server([pendingBody]);
            let armed = true;
            // The first time read once the view's times row exists is the paint that follows enter
            const now = () => {
                if (armed && document.querySelector(".session-times") !== null) {
                    armed = false;
                    throw new Error("paint failed");
                }
                return new Date();
            };
            open({ scenario: scenarios["ended-pending"], fetch: srv.fetch, now });
            await settle();
            expect(reported).toHaveBeenCalledTimes(1);
            expect(srv.gets()).toHaveLength(1);
            await advance(4_999);
            expect(srv.gets()).toHaveLength(1);
            await advance(1);
            expect(srv.gets()).toHaveLength(2);
        } finally {
            vi.unstubAllGlobals();
        }
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
        // The record holds the reason, so the status says it once the record shows
        expect(status(app)).toBe(copy.ended("stopped"));
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
        expect(status(app)).toBe(copy.ended("stopped"));
        expect(q(app, ".map svg.map-svg")).not.toBeNull();
    });

    it("says the sandbox ended while it loads the record, then gives the reason", async () => {
        const srv = server([runningBody], { live: 'event: end\ndata: {"reason":"ended"}\n\n' });
        let answerNow: (r: Response) => void = () => {};
        let asks = 0;
        const fetch = (async (url: string, init: RequestInit) => {
            if (!url.endsWith("/live") && init.method === "POST" && ++asks === 2) {
                return new Promise<Response>((resolve) => (answerNow = resolve));
            }
            return srv.fetch(url, init);
        }) as unknown as typeof globalThis.fetch;
        const { app } = open({ scenario: running, fetch });
        await settle();
        await settle();
        expect(asks).toBe(2);
        expect(status(app)).toBe(copy.sandboxEnded);
        expect(q(app, ".session-state .dot")?.hidden).toBe(true);
        answerNow(answer(first(scenarios["ended-full"])));
        await settle();
        expect(status(app)).toBe(copy.ended("stopped"));
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
        expect(stored(running)).toBe("gone:not-found");
        expect(document.activeElement).toBe(q(app, ".message"));
        await advance(60_000);
        expect(srv.gets()).toHaveLength(2);
    });

    it("shows the not-found line when a stream answers 404", async () => {
        const srv = server([runningBody], { live: { status: 404, body: null } });
        const { app } = open({ scenario: running, fetch: srv.fetch });
        await settle();
        expect(message(app)).toBe(copy.notFound);
        expect(stored(running)).toBe("gone:not-found");
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
        expect(stored(s)).toBe("gone:expired");
        expect(document.activeElement).toBe(q(app, ".message"));
    });

    it("forgets the key when the link is not found", async () => {
        const s = scenarios["ended-full"];
        const srv = server([{ status: 404, body: null }]);
        const { app } = open({ scenario: s, fetch: srv.fetch });
        await settle();
        expect(message(app)).toBe(copy.notFound);
        expect(stored(s)).toBe("gone:not-found");
    });

    it("says how the page ended on a reload after it, never that the key is missing", async () => {
        const cases: [Scenario, Answer, string][] = [
            [scenarios.expired, first(scenarios.expired), copy.expired],
            [scenarios["ended-full"], { status: 404, body: null }, copy.notFound],
        ];
        for (const [s, end, line] of cases) {
            const srv = server([end]);
            open({ scenario: s, fetch: srv.fetch });
            await settle();
            const again = server([first(scenarios["ended-full"])]);
            const { app } = open({ scenario: s, hash: "", fetch: again.fetch });
            await settle();
            expect(message(app), s.kind).toBe(line);
            expect(again.calls, s.kind).toEqual([]);
            expect(document.body.textContent).not.toContain(copy.noKey);
        }
    });

    it("offers a retry after a 429, and a retry asks again once", async () => {
        const s = scenarios["rate-limited"];
        const srv = server([{ status: 429, body: null }, first(scenarios["ended-full"])]);
        const { app } = open({ scenario: s, fetch: srv.fetch });
        await settle();
        expect(message(app)).toBe(copy.rateLimited);
        const retry = button(app, "button.retry");
        expect(shownLabel(retry)).toBe(copy.retry);
        retry.click();
        retry.click();
        await settle();
        expect(srv.gets()).toHaveLength(2);
        await advance(400);
        expect(rows(app)).toBe(6);
    });

    it("says it is loading for at least 400 ms after a retry, even when the answer is quick", async () => {
        const srv = server([{ status: 429, body: null }]);
        const { app } = open({ scenario: scenarios["rate-limited"], fetch: srv.fetch });
        await settle();
        const retry = button(app, "button.retry");
        expect(retry.textContent).toBe(copy.retry + copy.loading);
        retry.click();
        expect(shownLabel(retry)).toBe(copy.loading);
        expect(retry.disabled).toBe(true);
        await settle();
        expect(srv.gets()).toHaveLength(2);
        // The same answer came at once, yet the page still shows that it is trying
        expect(q(app, "button.retry")).toBe(retry);
        await advance(399);
        expect(q(app, "button.retry")).toBe(retry);
        await advance(1);
        const again = button(app, "button.retry");
        expect(again).not.toBe(retry);
        expect(shownLabel(again)).toBe(copy.retry);
        expect(again.disabled).toBe(false);
        expect(document.activeElement).toBe(q(app, "p.message"));
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
        expect(stored(s)).toBe("gone:deleted");
        expect(document.activeElement).toBe(q(app, ".message"));

        const again = server([first(s)]);
        const reloaded = open({ scenario: s, hash: "", fetch: again.fetch });
        await settle();
        expect(message(reloaded.app)).toBe(copy.deleted);
        expect(again.calls).toEqual([]);
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
        expect(q(app, ".session-times")?.hidden).toBe(false);
        expect(q(app, ".confirm-text")?.hidden).toBe(true);
        expect(document.activeElement).toBe(q(app, "button.delete-now"));
        expect(srv.deletes()).toHaveLength(0);
    });

    it("asks in place of the times and Delete now, so nothing below it moves", async () => {
        const srv = server([first(s)]);
        const { app } = open({ scenario: s, fetch: srv.fetch });
        await settle();
        const meta = q(app, ".session-meta")!;
        const shown = () =>
            [...meta.querySelectorAll<HTMLElement>("*")]
                .filter((e) => e.closest("[hidden]") === null)
                .map((e) => e.className)
                .filter((c) => c !== "" && c !== "time-part");
        expect(shown()).toEqual(["session-times parts", "delete", "button delete-now danger"]);
        button(app, "button.delete-now").click();
        expect(shown()).toEqual([
            "confirm-text",
            "delete",
            "confirm",
            "button confirm-delete danger",
            "button cancel-delete",
        ]);
        const prompt = q(app, ".confirm-text")!;
        expect(prompt.textContent).toBe(copy.confirmDelete);
        expect(prompt.getAttribute("aria-live")).toBe("polite");
        expect(document.activeElement).toBe(prompt);
        expect(meta.firstElementChild).toBe(q(app, ".session-times"));
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
