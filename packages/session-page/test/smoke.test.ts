/**
 * Serves the built page with the fake sessions route on port 0 and drives it end to end in a
 * headless browser, under the route's real headers, CSP and Trusted Types included.
 *
 * Every page records its CSP violations and page errors from before its first script runs, so a
 * refusal anywhere fails the test that caused it. Firefox and WebKit, when a build of either is
 * installed, run the ended view and the delete flow, the two calls whose Origin they handle apart,
 * and draw a bubble's keyboard ring, which WebKit paints for no outline on an SVG group.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Browser, BrowserContext, BrowserContextOptions, Page, Route } from "playwright-core";
import { buildPage } from "../src/build.ts";
import { copy } from "../src/copy.ts";
import { isSignature } from "../src/payload.ts";
import { COPIED_MS } from "../src/render/controls.ts";
import { findLauncher, findOtherLaunchers, type Launcher } from "../src/testing/browser.ts";
import { makeScenarios, type Scenario } from "../src/testing/fixtures.ts";
import { startFakeRoute, type FakeRoute } from "../src/testing/route.ts";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const markup = "<img src=x onerror=alert(1)>";
// Valid in shape, so the page asks the route, which knows no such session
const unknownId = "zzzzzzzzzzzzzzzz";
const unknownKey = `bnk_${"A".repeat(43)}`;
const explorer = /^https:\/\/explorer\.solana\.com\/tx\/([1-9A-HJ-NP-Za-km-z]+)$/;
const ownLinks = [
    "https://bugnet.sh/",
    "https://bugnet.sh/terms",
    "https://bugnet.sh/privacy",
    "mailto:abuse@bugnet.org",
];

const launcher = await findLauncher();
const others = await findOtherLaunchers();

beforeAll(async () => {
    await buildPage({ outdir: dist });
}, 60_000);

interface Opened {
    page: Page;
    errors: string[];
    dialogs: string[];
    requests: string[];
    violations(): Promise<string[]>;
}

// One context per page, so no page sees another's sessionStorage
function opener(contexts: BrowserContext[]) {
    return async (
        browser: Browser,
        url: string,
        options: BrowserContextOptions = {},
        // Set up before the page opens, such as a held answer
        before?: (page: Page) => Promise<unknown>,
    ): Promise<Opened> => {
        const context = await browser.newContext({
            viewport: { width: 1280, height: 900 },
            ...options,
        });
        contexts.push(context);
        const page = await context.newPage();
        const errors: string[] = [];
        const dialogs: string[] = [];
        const requests: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("request", (r) => requests.push(`${r.method()} ${r.url()}`));
        page.on("dialog", (d) => {
            dialogs.push(d.message());
            void d.dismiss();
        });
        await page.addInitScript(() => {
            const w = window as unknown as { violations: string[] };
            w.violations = [];
            document.addEventListener("securitypolicyviolation", (e) => {
                w.violations.push(`${e.effectiveDirective} ${e.blockedURI}`);
            });
        });
        await before?.(page);
        await page.goto(url);
        const violations = () =>
            page.evaluate(() => (window as unknown as { violations: string[] }).violations);
        return { page, errors, dialogs, requests, violations };
    };
}

const linkOf = (route: FakeRoute, s: Pick<Scenario, "id" | "key">) =>
    `${route.origin}/s/${s.id}#k=${s.key}`;

async function endedView(page: Page): Promise<void> {
    await page.locator(".map").waitFor({ state: "visible" });
    await page.locator("tr.cmd-row").first().waitFor({ state: "visible" });
}

async function messageShows(page: Page, text: string): Promise<void> {
    await page.locator("p.message", { hasText: text }).waitFor({ state: "visible" });
}

// The colours as the page computes them, the accent, --bad, --text and --text-muted
const ACCENT = "rgb(82, 255, 184)";
const BAD = "rgb(255, 107, 107)";
const TEXT = "rgb(237, 237, 237)";
const MUTED = "rgb(161, 161, 161)";
const LINE = "rgb(38, 38, 38)";
const FONTS = ["15px Manrope", "600 15px Manrope", '200 32px "Lexend Deca"', '13px "Obel Mono"'];
// The copy button's flash and a margin
const AFTER_COPIED_MS = COPIED_MS + 500;

interface Ring {
    focused: string;
    style: string;
    color: string;
    // The element's own outline, which a bubble and a table control leave to another mark
    own: string;
}

// The ring as drawn: a bubble's circle in the map, a table control's ::after, else the outline
function focusRing(page: Page): Promise<Ring> {
    return page.evaluate(() => {
        const el = document.activeElement!;
        const cs = getComputedStyle(el);
        const id = el.getAttribute("data-node-id");
        const tag = `${el.tagName.toLowerCase()}.${el.getAttribute("class")}`;
        const focused = id ? `${tag}[${id}]` : tag;
        const own = cs.outlineStyle;
        const circle = el.querySelector("circle.map-focus");
        if (circle !== null) {
            const ring = getComputedStyle(circle);
            const shown = ring.visibility === "visible";
            return { focused, own, style: shown ? "solid" : "none", color: ring.stroke };
        }
        const after = getComputedStyle(el, "::after");
        const drawn = own === "none" && after.outlineStyle !== "none" ? after : cs;
        return { focused, own, style: drawn.outlineStyle, color: drawn.outlineColor };
    });
}

// Clicked, then reached again from the keyboard: no ring, then the accent ring
async function ringsForKeysOnly(page: Page, selector: string, focused: string): Promise<void> {
    await page.locator(selector).click();
    const clicked = await focusRing(page);
    expect(clicked.focused).toContain(focused);
    expect(clicked.style, selector).toBe("none");
    expect(clicked.own, selector).toBe("none");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const keyed = await focusRing(page);
    expect(keyed.focused).toBe(clicked.focused);
    expect(keyed.style, selector).toBe("solid");
    expect(keyed.color, selector).toBe(ACCENT);
}

function colours(page: Page, selector: string): Promise<{ color: string; border: string }> {
    return page.locator(selector).evaluate((el) => {
        const cs = getComputedStyle(el);
        return { color: cs.color, border: cs.borderTopColor };
    });
}

async function expectClean(o: Opened): Promise<void> {
    expect(await o.violations()).toEqual([]);
    expect(o.errors).toEqual([]);
    expect(o.dialogs).toEqual([]);
}

describe.runIf(launcher !== null)(`in a headless browser (${launcher?.label ?? "none"})`, () => {
    let browser: Browser;
    let route: FakeRoute;
    const scenarios = makeScenarios(new Date());
    const contexts: BrowserContext[] = [];
    const open = opener(contexts);

    beforeAll(async () => {
        browser = await (launcher as Launcher).launch();
        route = await startFakeRoute(dist, scenarios, { liveDelayMs: 50 });
    }, 60_000);

    afterEach(async () => {
        for (const c of contexts.splice(0)) await c.close();
    });

    afterAll(async () => {
        await browser?.close();
        await route?.close();
    });

    it("drops the key from the address and asks once at open", async () => {
        const s = scenarios["ended-full"];
        const o = await open(browser, linkOf(route, s));
        await endedView(o.page);
        await o.page.waitForLoadState("networkidle");
        const href = await o.page.evaluate(() => location.href);
        expect(href).toBe(`${route.origin}/s/${s.id}`);
        expect(href).not.toContain("#");
        expect(href).not.toContain(s.key);
        expect(o.requests.filter((r) => r.includes("/v1/"))).toEqual([
            `POST ${route.origin}/v1/s/${s.id}`,
        ]);
        await expectClean(o);
    });

    it("shows the map and six commands for ended-full, with nothing refused", async () => {
        const o = await open(browser, linkOf(route, scenarios["ended-full"]));
        await endedView(o.page);
        expect(await o.page.locator(".map-svg").isVisible()).toBe(true);
        expect(await o.page.locator("tr.cmd-row").count()).toBe(6);
        await expectClean(o);
    });

    it("works after a reload from the key kept in sessionStorage", async () => {
        const s = scenarios["ended-full"];
        const o = await open(browser, linkOf(route, s));
        await endedView(o.page);
        await o.page.reload();
        expect(o.page.url()).toBe(`${route.origin}/s/${s.id}`);
        await endedView(o.page);
        expect(await o.page.locator("tr.cmd-row").count()).toBe(6);
        const asked = route.requests.filter((r) => r.path === `/v1/s/${s.id}`).at(-1);
        expect(JSON.parse(asked?.body ?? "{}")).toEqual({ k: s.key });
        await expectClean(o);
    });

    it("shows hostile output as text, with no image, link or dialog", async () => {
        const o = await open(browser, linkOf(route, scenarios["ended-hostile"]));
        await endedView(o.page);
        await o.page.locator("button.expand-all").click();
        const line = o.page.locator(".term-out .line", { hasText: markup }).first();
        await line.waitFor({ state: "visible" });
        expect(await line.textContent()).toBe(markup);
        expect(await o.page.locator(".term-out img").count()).toBe(0);
        expect(await o.page.locator(".term-out a").count()).toBe(0);
        expect(await o.page.locator("img").count()).toBe(0);
        await expectClean(o);
    });

    it("streams a running session, updates a progress line in place, then ends", async () => {
        const o = await open(browser, linkOf(route, scenarios.running));
        const { page } = o;
        await page.locator("tr.cmd-detail:not([hidden]) .term-out .line").first().waitFor();

        // The build command draws its progress bar with cr frames
        const toggle = page.locator('tr.cmd-row[data-seq="3"] .cmd-toggle');
        await toggle.click();
        const block = `#${await toggle.getAttribute("aria-controls")} .term-out`;
        const bars = (sel: string) =>
            [...document.querySelectorAll(`${sel} .line`)].filter((l) =>
                l.textContent?.startsWith("rendering chunks"),
            ).length;
        await page.waitForFunction(bars, block);
        const bar = await page
            .locator(`${block} .line`, { hasText: "rendering chunks" })
            .elementHandle();
        const first = await bar.textContent();
        // The same node, still in the page, now says something else
        await page.waitForFunction(
            ([node, text]) => node.isConnected && node.textContent !== text,
            [bar, first] as const,
        );
        expect(await page.evaluate(bars, block)).toBe(1);

        await page.locator(".map").waitFor({ state: "visible", timeout: 30_000 });
        // The route answers ended-full's record once the placement ends
        expect(await page.locator(".session-state").textContent()).toBe(copy.ended("stopped"));
        await expectClean(o);
    }, 60_000);

    it("deletes after the inline confirm, with one DELETE", async () => {
        const s = scenarios.deletable;
        const o = await open(browser, linkOf(route, s));
        await o.page.locator("tr.cmd-row").first().waitFor({ state: "visible" });
        await o.page.locator("button.delete-now").click();
        await o.page.locator("button.confirm-delete").click();
        await messageShows(o.page, copy.deleted);
        const deletes = route.requests.filter((r) => r.method === "DELETE");
        expect(deletes.map((r) => r.path)).toEqual([`/v1/s/${s.id}`]);
        await expectClean(o);
    });

    it("says the link doesn't work for an unknown id", async () => {
        const o = await open(browser, linkOf(route, { id: unknownId, key: unknownKey }));
        await messageShows(o.page, copy.notFound);
        await expectClean(o);
    });

    it("opens a bubble's table from the keyboard, and Enter or Escape closes it", async () => {
        const o = await open(browser, linkOf(route, scenarios["ended-full"]));
        const { page } = o;
        await endedView(page);
        const focusedNode = () =>
            page.evaluate(() =>
                document.activeElement?.closest("g.map-node")?.getAttribute("data-node-id"),
            );
        let id: string | null | undefined = null;
        for (let i = 0; i < 20 && !id; i++) {
            await page.keyboard.press("Tab");
            id = await focusedNode();
        }
        expect(id).toBeTruthy();
        const table = page.locator(`.map-table .table-scroll[data-node-id="${id}"]`);

        await page.keyboard.press("Enter");
        await table.waitFor({ state: "visible" });
        expect(await focusedNode()).toBe(id);
        await page.keyboard.press("Enter");
        await table.waitFor({ state: "detached" });
        await page.keyboard.press("Enter");
        await table.waitFor({ state: "visible" });
        await page.keyboard.press("Escape");
        await table.waitFor({ state: "detached" });
        await expectClean(o);
    });

    it("draws a focus ring for the keyboard only, never for a click", async () => {
        const o = await open(browser, linkOf(route, scenarios["ended-full"]));
        const { page } = o;
        await endedView(page);
        const targets = [
            { click: 'g.map-node[data-node-id="payments"] circle.map-bubble', focused: "payments" },
            { click: 'tr.cmd-row[data-seq="2"] .cmd-toggle', focused: "cmd-toggle" },
            { click: "button.expand-all", focused: "expand-all" },
        ];
        for (const target of targets) await ringsForKeysOnly(page, target.click, target.focused);
        await expectClean(o);
    });

    it("rings a phone row and both delete buttons for the keyboard, and mutes a busy Delete", async () => {
        let held: Route | null = null;
        const o = await open(
            browser,
            linkOf(route, scenarios["ended-full"]),
            { viewport: { width: 375, height: 812 } },
            // The DELETE never reaches the route, so the session stays for the other tests
            (page) =>
                page.route("**/v1/**", (r) => {
                    if (r.request().method() === "DELETE") held = r;
                    else void r.continue();
                }),
        );
        const { page } = o;
        await page.locator("tr.cmd-row").first().waitFor({ state: "visible" });
        await ringsForKeysOnly(page, 'button.map-row[data-node-id="payments"]', "map-row");
        // A click on Delete now hands focus to its prompt, so it is reached from the keyboard only
        await page.locator("button.delete-now").focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        const start = await focusRing(page);
        expect(start.focused).toContain("delete-now");
        expect([start.style, start.color]).toEqual(["solid", ACCENT]);
        // The prompt takes focus, and the next Tab stop is Delete
        await page.keyboard.press("Enter");
        await page.locator("button.confirm-delete").waitFor({ state: "visible" });
        await page.keyboard.press("Tab");
        const ring = await focusRing(page);
        expect(ring.focused).toContain("confirm-delete");
        expect([ring.style, ring.color]).toEqual(["solid", ACCENT]);
        await page.keyboard.press("Enter");
        await expect.poll(() => held !== null).toBe(true);
        expect(await page.locator("button.confirm-delete").isDisabled()).toBe(true);
        expect(await colours(page, "button.confirm-delete")).toEqual({
            color: MUTED,
            border: LINE,
        });
        await (held as Route | null)?.fulfill({ status: 500 });
        await page.locator("p.confirm-text", { hasText: copy.deleteFailed }).waitFor();
        expect(await colours(page, "button.confirm-delete")).toEqual({ color: BAD, border: BAD });
        await expectClean(o);
    });

    it("keeps the heading where it is when the first view arrives", async () => {
        for (const width of [1280, 375]) {
            let release: (() => Promise<void>) | null = null;
            const o = await open(
                browser,
                linkOf(route, scenarios["ended-full"]),
                { viewport: { width, height: 900 } },
                (page) =>
                    page.route("**/v1/**", (r) => {
                        if (release === null) release = () => r.continue();
                        else void r.continue();
                    }),
            );
            const { page } = o;
            await page.locator("h1").waitFor({ state: "visible" });
            await expect.poll(() => release !== null).toBe(true);
            const top = () => page.locator("h1").evaluate((h) => h.getBoundingClientRect().top);
            const before = await top();
            expect(await page.locator(".map").count()).toBe(0);
            await (release as (() => Promise<void>) | null)?.();
            await endedView(page);
            expect(await top(), `at ${width} px`).toBe(before);
            await expectClean(o);
        }
    });

    it("keeps every face loaded as the page crosses 768 px and back", async () => {
        const o = await open(browser, linkOf(route, scenarios["ended-full"]));
        const { page } = o;
        await endedView(page);
        for (const width of [1280, 375, 1280]) {
            await page.setViewportSize({ width, height: 900 });
            await page.waitForFunction(
                (fonts) => fonts.every((f) => document.fonts.check(f)),
                FONTS,
                { timeout: 5_000 },
            );
        }
        await expectClean(o);
    });

    it("never leaves a control focused from the keyboard under a sticky head", async () => {
        const o = await open(browser, linkOf(route, scenarios["ended-crowded"]), {
            viewport: { width: 1440, height: 700 },
        });
        const { page } = o;
        await endedView(page);
        // The fold's table is long enough to scroll inside, and every command is open
        await page.locator('g.map-node[data-node-id="more-right"] circle.map-bubble').click();
        await page.locator(".map-table .table-scroll").waitFor();
        await page.locator("button.expand-all").click();
        await page.locator("footer.site a").last().focus();
        const covered: string[] = [];
        let inTables = 0;
        for (let i = 0; i < 400; i++) {
            await page.keyboard.press("Shift+Tab");
            const m = await page.evaluate(() => {
                const el = document.activeElement!;
                const table = el.closest("table");
                // The th, since a stuck cell moves while its row's box stays where it was
                const th = table?.querySelector("thead th");
                if (!table || !th) return { inMap: el.closest(".map") !== null, cover: null };
                const a = el.getBoundingClientRect();
                const b = th.getBoundingClientRect();
                const cover = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
                const name = `${el.tagName.toLowerCase()}.${el.getAttribute("class")}`;
                return { inMap: false, cover: cover > 0 ? `${name} ${cover}` : "" };
            });
            if (m.inMap) break;
            if (m.cover === null) continue;
            inTables++;
            if (m.cover !== "") covered.push(m.cover);
        }
        expect(inTables).toBeGreaterThan(60);
        expect(covered).toEqual([]);
        await expectClean(o);
    }, 60_000);

    it("prints every output block and event table whole, with no buttons", async () => {
        const o = await open(browser, linkOf(route, scenarios["ended-hostile"]));
        const { page } = o;
        await endedView(page);
        await page.locator("button.expand-all").click();
        await page.locator(".term-out .line", { hasText: "RED ALERT" }).waitFor();
        await page.locator("g.map-node circle.map-bubble").nth(1).click();
        await page.locator(".map-table .table-scroll").waitFor();
        await page.emulateMedia({ media: "print" });
        const printed = await page.evaluate(() => ({
            cut: [...document.querySelectorAll(".term-cmd, .term-out, .table-scroll")]
                .filter((el) => el.scrollHeight > el.clientHeight + 1)
                .map((el) => `${el.className} ${el.scrollHeight} > ${el.clientHeight}`),
            shown: [...document.querySelectorAll(".delete, .copy-button, .commands-bar, .tip")]
                .filter((el) => el.getClientRects().length > 0)
                .map((el) => el.className),
        }));
        expect(printed).toEqual({ cut: [], shown: [] });
        await expectClean(o);
    });

    it("keeps a phone list row's text off the selected ring on both sides", async () => {
        const o = await open(browser, linkOf(route, scenarios["ended-full"]), {
            viewport: { width: 375, height: 812 },
        });
        const { page } = o;
        await page.locator("tr.cmd-row").first().waitFor({ state: "visible" });
        await page.locator('button.map-row[data-node-id="payments"]').click();
        const gaps = await page.locator("button.map-row.is-selected").evaluate((row) => {
            const box = row.getBoundingClientRect();
            const name = row.querySelector(".map-row-name")!.getBoundingClientRect();
            const metric = row.querySelector(".map-row-metric")!.getBoundingClientRect();
            return { left: name.left - box.left, right: box.right - metric.right };
        });
        expect(gaps.left).toBeGreaterThanOrEqual(8);
        expect(gaps.right).toBeGreaterThanOrEqual(8);
        await expectClean(o);
    });

    it("keeps the list's lines, its selected row and the head's line in forced colours", async () => {
        const o = await open(browser, linkOf(route, scenarios["ended-full"]), {
            viewport: { width: 375, height: 812 },
            forcedColors: "active",
        });
        const { page } = o;
        await page.locator("tr.cmd-row").first().waitFor({ state: "visible" });
        await page.locator('button.map-row[data-node-id="payments"]').click();
        const look = (selector: string) =>
            page
                .locator(selector)
                .first()
                .evaluate((el) => {
                    const cs = getComputedStyle(el);
                    return {
                        line: `${cs.borderBottomStyle} ${cs.borderBottomWidth}`,
                        ring: cs.outlineStyle,
                    };
                });
        expect((await look('button.map-row[data-node-id="mcp"]')).line).toBe("solid 1px");
        expect((await look("button.map-row.is-selected")).ring).toBe("solid");
        expect((await look("table.commands thead th")).line).toBe("solid 1px");
        await expectClean(o);
    });

    it("draws Delete now and Delete in the failure colour, hovered or not", async () => {
        // Cancelled, never confirmed, since an earlier test deletes the deletable session
        const o = await open(browser, linkOf(route, scenarios["ended-full"]));
        const { page } = o;
        await page.locator("tr.cmd-row").first().waitFor({ state: "visible" });
        const red = { color: BAD, border: BAD };
        expect(await colours(page, "button.delete-now")).toEqual(red);
        await page.locator("button.delete-now").hover();
        expect(await colours(page, "button.delete-now")).toEqual(red);
        await page.locator("button.delete-now").click();
        expect(await colours(page, "button.confirm-delete")).toEqual(red);
        await page.locator("button.confirm-delete").hover();
        expect(await colours(page, "button.confirm-delete")).toEqual(red);
        expect((await colours(page, "button.cancel-delete")).color).toBe(TEXT);
        await expectClean(o);
    });

    it("asks Delete for everyone without moving anything below it", async () => {
        for (const width of [768, 375]) {
            const o = await open(browser, linkOf(route, scenarios["ended-full"]), {
                viewport: { width, height: 900 },
            });
            const { page } = o;
            await page.locator(".map").waitFor({ state: "visible" });
            const tops = () =>
                page.evaluate(() =>
                    [".session-meta", ".map", "table.commands"].map(
                        (sel) => document.querySelector(sel)!.getBoundingClientRect().top,
                    ),
                );
            const before = await tops();
            await page.locator("button.delete-now").click();
            await page.locator("button.confirm-delete").waitFor({ state: "visible" });
            expect(await tops(), `at ${width} px`).toEqual(before);
            await page.locator("button.cancel-delete").click();
            expect(await tops(), `at ${width} px`).toEqual(before);
            await expectClean(o);
        }
    });

    it("leaves no accent on a tapped control once it has done its job", async () => {
        const o = await open(browser, linkOf(route, scenarios["ended-full"]), {
            viewport: { width: 375, height: 812 },
            isMobile: true,
            hasTouch: true,
        });
        const { page } = o;
        await page.locator("tr.cmd-row").first().waitFor({ state: "visible" });
        expect(await page.evaluate(() => matchMedia("(hover: hover)").matches)).toBe(false);
        const copyButton = page.locator("tr.cmd-detail:not([hidden]) .term-head .copy-output");
        await copyButton.tap();
        await page.waitForTimeout(AFTER_COPIED_MS);
        expect(
            (await colours(page, "tr.cmd-detail:not([hidden]) .term-head .copy-output")).color,
        ).toBe(MUTED);
        const toggle = page.locator('tr.cmd-row[data-seq="6"] .cmd-toggle');
        await toggle.tap();
        expect(await toggle.getAttribute("aria-expanded")).toBe("false");
        expect((await colours(page, 'tr.cmd-row[data-seq="6"] .cmd-toggle')).color).toBe(TEXT);
        await expectClean(o);
    });

    // The bugnet.sh pages do not exist yet, so they are checked by shape and never fetched
    it("links only to Bugnet's own pages and to explorer transactions", async () => {
        const o = await open(browser, linkOf(route, scenarios["ended-full"]));
        const { page } = o;
        await endedView(page);
        await page.locator("button.expand-all").click();
        const ids = await page
            .locator("g.map-node")
            .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-node-id") ?? ""));
        expect(ids.length).toBeGreaterThan(1);

        const links: { href: string; rel: string; target: string }[] = [];
        const collect = async () => {
            const found = await page.evaluate(() =>
                [...document.querySelectorAll("a[href]")].map((a) => ({
                    href: a.getAttribute("href") ?? "",
                    rel: a.getAttribute("rel") ?? "",
                    target: a.getAttribute("target") ?? "",
                })),
            );
            links.push(...found);
        };
        await collect();
        for (const id of ids) {
            // The bubble's own circle, since the middle of its box can fall between it and its label
            await page.locator(`g.map-node[data-node-id="${id}"] circle.map-bubble`).click();
            await page.locator(`.map-table .table-scroll[data-node-id="${id}"]`).waitFor();
            await collect();
        }

        const txs: string[] = [];
        for (const { href, rel, target } of links) {
            expect(rel.split(/\s+/), href).toContain("noreferrer");
            const tx = explorer.exec(href)?.[1];
            if (tx === undefined) {
                expect(ownLinks, href).toContain(href);
                continue;
            }
            expect(isSignature(tx), href).toBe(true);
            expect(target, href).toBe("_blank");
            txs.push(tx);
        }
        expect(new Set(links.map((l) => l.href).filter((h) => ownLinks.includes(h)))).toEqual(
            new Set(ownLinks),
        );
        expect(txs.length).toBeGreaterThan(0);
        await expectClean(o);
    }, 60_000);
});

// The share of a crop's pixels near the accent, decoded on a blank page, since the session
// page's CSP refuses a data: image
async function accentPixels(browser: Browser, png: Buffer): Promise<number> {
    const scratch = await browser.newPage();
    try {
        return await scratch.evaluate(
            async (src) => {
                const img = new Image();
                img.src = src;
                await img.decode();
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d")!;
                ctx.drawImage(img, 0, 0);
                const { data } = ctx.getImageData(0, 0, img.width, img.height);
                let n = 0;
                for (let i = 0; i < data.length; i += 4) {
                    const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
                    if (Math.abs(r - 82) < 40 && g > 200 && Math.abs(b - 184) < 40) n++;
                }
                return n;
            },
            `data:image/png;base64,${png.toString("base64")}`,
        );
    } finally {
        await scratch.close();
    }
}

describe.each(others.map((l) => [l.label, l] as const))(
    "in %s, which handles a state change's Origin apart from Chromium",
    (_label, other) => {
        let browser: Browser;
        let route: FakeRoute;
        const scenarios = makeScenarios(new Date());
        const contexts: BrowserContext[] = [];
        const open = opener(contexts);

        beforeAll(async () => {
            browser = await other.launch();
            route = await startFakeRoute(dist, scenarios, { liveDelayMs: 50 });
        }, 60_000);

        afterAll(async () => {
            for (const c of contexts) await c.close();
            await browser?.close();
            await route?.close();
        });

        it("shows ended-full with the page's own Origin on its POST", async () => {
            const s = scenarios["ended-full"];
            const o = await open(browser, linkOf(route, s));
            await endedView(o.page);
            expect(await o.page.locator("tr.cmd-row").count()).toBe(6);
            const post = route.requests.find((r) => r.path === `/v1/s/${s.id}`);
            expect(post?.method).toBe("POST");
            expect(post?.headers.origin).toBe(route.origin);
            await expectClean(o);
        }, 60_000);

        it("deletes with the page's own Origin on its DELETE", async () => {
            const s = scenarios.deletable;
            const o = await open(browser, linkOf(route, s));
            await o.page.locator("tr.cmd-row").first().waitFor({ state: "visible" });
            await o.page.locator("button.delete-now").click();
            await o.page.locator("button.confirm-delete").click();
            await messageShows(o.page, copy.deleted);
            const deletes = route.requests.filter((r) => r.method === "DELETE");
            expect(deletes).toHaveLength(1);
            expect(deletes[0]?.headers.origin).toBe(route.origin);
            await expectClean(o);
        }, 60_000);

        it("draws a bubble's keyboard ring in the accent", async () => {
            const o = await open(browser, linkOf(route, scenarios["ended-full"]));
            const { page } = o;
            await endedView(page);
            const bubble = page.locator('g.map-node[data-node-id="payments"]');
            const box = await bubble.locator("circle.map-focus").boundingBox();
            expect(box).not.toBeNull();
            const clip = {
                x: box!.x - 8,
                y: box!.y - 8,
                width: box!.width + 16,
                height: box!.height + 16,
            };
            // Each shot in WebKit adds and drops a style element of Playwright's own to sync
            // animations, which the page's CSP refuses; anything else refused before it counts
            let shots = 0;
            const shot = () => {
                shots++;
                return page.screenshot({ clip, caret: "initial" });
            };
            const clean = await o.violations();
            const before = await accentPixels(browser, await shot());
            // Safari's Tab skips buttons and links by default, never the bubbles
            for (let i = 0; i < 40; i++) {
                await page.keyboard.press("Tab");
                const on = await page.evaluate(
                    () => document.activeElement?.getAttribute("data-node-id") ?? null,
                );
                if (on === "payments") break;
            }
            expect(await bubble.evaluate((g) => g === document.activeElement)).toBe(true);
            const after = await accentPixels(browser, await shot());
            expect(before).toBe(0);
            // A 2 px circle around the bubble, a ring of well over a hundred pixels
            expect(after).toBeGreaterThan(100);
            expect(clean).toEqual([]);
            const added = (await o.violations()).slice(clean.length);
            expect(added.length).toBeLessThanOrEqual(shots);
            expect(added.filter((v) => v !== "style-src-elem inline")).toEqual([]);
            expect(o.errors).toEqual([]);
            expect(o.dialogs).toEqual([]);
        }, 60_000);
    },
);
