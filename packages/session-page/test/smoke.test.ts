/**
 * Serves the built page with the fake sessions route on port 0 and drives it end to end in a
 * headless browser, under the route's real headers, CSP and Trusted Types included.
 *
 * Every page records its CSP violations and page errors from before its first script runs, so a
 * refusal anywhere fails the test that caused it. Firefox and WebKit, when a build of either is
 * installed, run the ended view and the delete flow, the two calls whose Origin they handle apart.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Browser, BrowserContext, Page } from "playwright-core";
import { buildPage } from "../src/build.ts";
import { copy } from "../src/copy.ts";
import { isSignature } from "../src/payload.ts";
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
    "mailto:abuse@bugnet.sh",
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
    return async (browser: Browser, url: string): Promise<Opened> => {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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
        await page.goto(url);
        const violations = () =>
            page.evaluate(() => (window as unknown as { violations: string[] }).violations);
        return { page, errors, dialogs, requests, violations };
    };
}

const linkOf = (route: FakeRoute, s: Pick<Scenario, "id" | "key">) =>
    `${route.origin}/s/${s.id}#k=${s.key}`;

async function showOutput(page: Page): Promise<void> {
    await page.locator("button.show-output").click();
}

async function endedView(page: Page): Promise<void> {
    await page.locator(".map").waitFor({ state: "visible" });
    await page.locator("tr.cmd-row").first().waitFor({ state: "visible" });
}

async function messageShows(page: Page, text: string): Promise<void> {
    await page.locator("p.message", { hasText: text }).waitFor({ state: "visible" });
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

    it("drops the key from the address and asks nothing before the click", async () => {
        const s = scenarios["ended-full"];
        const o = await open(browser, linkOf(route, s));
        await o.page.locator("button.show-output").waitFor({ state: "visible" });
        await o.page.waitForLoadState("networkidle");
        const href = await o.page.evaluate(() => location.href);
        expect(href).toBe(`${route.origin}/s/${s.id}`);
        expect(href).not.toContain("#");
        expect(o.requests.filter((r) => r.includes("/v1/"))).toEqual([]);

        await showOutput(o.page);
        await endedView(o.page);
        expect(o.requests.filter((r) => r.includes("/v1/"))).toEqual([
            `POST ${route.origin}/v1/s/${s.id}`,
        ]);
    });

    it("shows the map and six commands for ended-full, with nothing refused", async () => {
        const o = await open(browser, linkOf(route, scenarios["ended-full"]));
        await showOutput(o.page);
        await endedView(o.page);
        expect(await o.page.locator(".map-svg").isVisible()).toBe(true);
        expect(await o.page.locator("tr.cmd-row").count()).toBe(6);
        await expectClean(o);
    });

    it("works after a reload from the key kept in sessionStorage", async () => {
        const s = scenarios["ended-full"];
        const o = await open(browser, linkOf(route, s));
        await o.page.locator("button.show-output").waitFor({ state: "visible" });
        await o.page.reload();
        expect(o.page.url()).toBe(`${route.origin}/s/${s.id}`);
        await showOutput(o.page);
        await endedView(o.page);
        expect(await o.page.locator("tr.cmd-row").count()).toBe(6);
        const asked = route.requests.filter((r) => r.path === `/v1/s/${s.id}`).at(-1);
        expect(JSON.parse(asked?.body ?? "{}")).toEqual({ k: s.key });
        await expectClean(o);
    });

    it("shows hostile output as text, with no image, link or dialog", async () => {
        const o = await open(browser, linkOf(route, scenarios["ended-hostile"]));
        await showOutput(o.page);
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
        await showOutput(page);
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
        expect(await page.locator(".session-state").textContent()).toBe(copy.sandboxEnded);
        await expectClean(o);
    }, 60_000);

    it("deletes after the inline confirm, with one DELETE", async () => {
        const s = scenarios.deletable;
        const o = await open(browser, linkOf(route, s));
        await showOutput(o.page);
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
        await showOutput(o.page);
        await messageShows(o.page, copy.notFound);
        await expectClean(o);
    });

    it("opens a bubble's table from the keyboard, and Enter or Escape closes it", async () => {
        const o = await open(browser, linkOf(route, scenarios["ended-full"]));
        const { page } = o;
        await showOutput(page);
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

    // The bugnet.sh pages do not exist yet, so they are checked by shape and never fetched
    it("links only to Bugnet's own pages and to explorer transactions", async () => {
        const o = await open(browser, linkOf(route, scenarios["ended-full"]));
        const { page } = o;
        await showOutput(page);
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
            await page.locator(`g.map-node[data-node-id="${id}"] circle`).click();
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
            await showOutput(o.page);
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
            await showOutput(o.page);
            await o.page.locator("tr.cmd-row").first().waitFor({ state: "visible" });
            await o.page.locator("button.delete-now").click();
            await o.page.locator("button.confirm-delete").click();
            await messageShows(o.page, copy.deleted);
            const deletes = route.requests.filter((r) => r.method === "DELETE");
            expect(deletes).toHaveLength(1);
            expect(deletes[0]?.headers.origin).toBe(route.origin);
            await expectClean(o);
        }, 60_000);
    },
);
