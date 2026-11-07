/**
 * Takes a full-page screenshot of each state at each checked width, into screens/ for a person to
 * look at, and measures the layout rules a screenshot alone would not prove: no sideways scroll,
 * one shared left edge, no overflowing box, 40 px targets in the tables, the four fonts loaded
 * and no CSP refusal.
 */
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page } from "playwright-core";
import { buildPage } from "../src/build.ts";
import { copy } from "../src/copy.ts";
import { findLauncher, type Launcher } from "../src/testing/browser.ts";
import { makeScenarios, type Scenario } from "../src/testing/fixtures.ts";
import { startFakeRoute, type FakeRoute } from "../src/testing/route.ts";

const screens = join(dirname(fileURLToPath(import.meta.url)), "..", "screens");
const fonts = ["15px Manrope", "600 15px Manrope", '200 32px "Lexend Deca"', '13px "Obel Mono"'];
const unknown = { id: "zzzzzzzzzzzzzzzz", key: `bnk_${"A".repeat(43)}` };

const launcher = await findLauncher();

const shots = [
    { width: 1440, scale: 1 },
    { width: 1024, scale: 1 },
    { width: 768, scale: 1 },
    { width: 375, scale: 1 },
    { width: 375, scale: 2 },
];

type Scenarios = ReturnType<typeof makeScenarios>;

interface State {
    name: string;
    link(s: Scenarios): Pick<Scenario, "id" | "key">;
    // The blocks between the session row and the footer that share the left edge, in page order
    edges: string[];
    // Set up before the page opens, such as a held answer
    before?(page: Page): Promise<void>;
    // Brings the opened page to the state the screenshot shows
    reach(page: Page): Promise<void>;
}

async function ended(page: Page): Promise<void> {
    await page.locator(".map").waitFor({ state: "visible" });
    await page.locator("tr.cmd-row").first().waitFor({ state: "visible" });
}

// The bubble's circle from 768 px, since its box's middle can miss it, or the list row
async function openNode(page: Page, id: string): Promise<void> {
    const node = `[data-node-id="${id}"]`;
    await page
        .locator(`g.map-node${node} circle.map-bubble, button.map-row${node}`)
        .filter({ visible: true })
        .click();
    await page.locator(`.map-table .table-scroll${node}`).waitFor();
}

async function message(page: Page, text: string): Promise<void> {
    await page.locator("p.message", { hasText: text }).waitFor({ state: "visible" });
}

// The open row draws on the next animation frame
async function openRowDrawn(page: Page): Promise<void> {
    await page.locator("tr.cmd-detail:not([hidden]) .term-out .line").first().waitFor();
}

const status = "p.session-state";
const times = "div.session-meta";

const states: State[] = [
    {
        name: "loading",
        edges: [],
        link: (s) => s["ended-full"],
        // The first answer never comes, so the page stays as it is while it waits
        before: async (page) => {
            await page.route("**/v1/**", () => undefined);
        },
        reach: (page) => page.locator("h1").waitFor({ state: "visible" }),
    },
    {
        name: "ended-full",
        edges: [status, times, "div.map", "table.commands"],
        link: (s) => s["ended-full"],
        reach: async (page) => {
            await ended(page);
            await openNode(page, "payments");
            await openRowDrawn(page);
        },
    },
    {
        name: "ended-crowded",
        edges: [status, times, "div.map", "table.commands"],
        link: (s) => s["ended-crowded"],
        // The fold's table, whose long hosts and paths once pushed its amounts out of view
        reach: async (page) => {
            await ended(page);
            await openNode(page, "more-right");
            await openRowDrawn(page);
        },
    },
    {
        name: "running",
        edges: [status, times, "p.map-later", "table.commands"],
        link: (s) => s.running,
        reach: async (page) => {
            await openRowDrawn(page);
            await page.waitForTimeout(2_000);
        },
    },
    {
        name: "ended-pending",
        edges: [status, times, "div.map", "p.commands-note"],
        link: (s) => s["ended-pending"],
        reach: async (page) => {
            await page.locator(".commands-note", { hasText: copy.savingOutput }).waitFor();
        },
    },
    {
        name: "expired",
        edges: ["p.message"],
        link: (s) => s.expired,
        reach: (page) => message(page, copy.expired),
    },
    {
        name: "not-found",
        edges: ["p.message"],
        link: () => unknown,
        reach: (page) => message(page, copy.notFound),
    },
    {
        name: "ended-hostile",
        edges: [status, times, "div.map", "table.commands"],
        link: (s) => s["ended-hostile"],
        // Every row open, so the escape codes, the long line and the flood are all on screen
        reach: async (page) => {
            await ended(page);
            await page.locator("button.expand-all").click();
            await page.locator(".term-out .line", { hasText: "RED ALERT" }).waitFor();
        },
    },
];

interface Measures {
    overflowX: number;
    // Every block marked as sharing the edge, measured where it starts a line of its own
    edges: { el: string; left: number; startsLine: boolean }[];
    // The children of the containers that start a line of their own
    lines: { el: string; left: number }[];
    overflowing: string[];
    // Event tables that scroll sideways, which would hide an amount or a transaction
    sideways: string[];
    shortTargets: string[];
    fonts: Record<string, boolean>;
}

// Runs in the page; a failure names each element by its tag, its classes and its node id
function measure(fontList: string[]): Measures {
    const name = (el: Element) =>
        [el.tagName.toLowerCase(), ...el.classList].join(".") +
        (el.getAttribute("data-node-id") ? `[${el.getAttribute("data-node-id")}]` : "");
    const rendered = (el: Element) => el.getClientRects().length > 0;

    // Where the text or content starts: the contents' box, or the element's own when it has none
    const contentLeft = (el: Element): number => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const r = range.getBoundingClientRect();
        return r.width > 0 || r.height > 0 ? r.left : el.getBoundingClientRect().left;
    };

    // Nothing drawn before it in its parent reaches down into its first line
    const startsLine = (el: Element): boolean => {
        const top = el.getBoundingClientRect().top;
        const before: Element[] = [];
        for (let s = el.previousElementSibling; s !== null; s = s.previousElementSibling) {
            if (rendered(s)) before.push(s);
        }
        return before.every((s) => s.getBoundingClientRect().bottom <= top + 0.5);
    };

    const containers = "div.session-head, div.session-meta, footer.site, div.map";
    const scrollers = ".term-out, .term-cmd, .table-scroll";
    return {
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
        edges: [...document.querySelectorAll("[data-edge]")].filter(rendered).map((el) => ({
            el: name(el),
            left: contentLeft(el),
            startsLine: startsLine(el),
        })),
        lines: [...document.querySelectorAll(containers)].flatMap((box) =>
            [...box.children]
                .filter((el) => rendered(el) && startsLine(el))
                .map((el) => ({
                    el: `${name(box)} > ${name(el)}`,
                    left: el.getBoundingClientRect().left,
                })),
        ),
        overflowing: [...document.querySelectorAll("*")]
            .filter((el) => el.closest(scrollers) === null)
            .filter((el) => el.scrollWidth > el.clientWidth + 1)
            .map((el) => `${name(el)} ${el.scrollWidth} > ${el.clientWidth}`),
        sideways: [...document.querySelectorAll(".table-scroll")]
            .filter((el) => el.scrollWidth > el.clientWidth + 1)
            .map((el) => `${name(el)} ${el.scrollWidth} > ${el.clientWidth}`),
        shortTargets: [...document.querySelectorAll("tr button, tr a[href]")]
            .filter(rendered)
            .filter((el) => el.getBoundingClientRect().height < 40)
            .map((el) => `${name(el)} ${el.getBoundingClientRect().height}`),
        fonts: Object.fromEntries(fontList.map((f) => [f, document.fonts.check(f)])),
    };
}

describe.runIf(launcher !== null)(`screenshots in ${launcher?.label ?? "no browser"}`, () => {
    let browser: Browser;
    let dist = "";

    // Its own build, so it never races the smoke test's rebuild of dist/
    beforeAll(async () => {
        dist = join(await mkdtemp(join(tmpdir(), "bugnet-session-screens-")), "dist");
        await buildPage({ outdir: dist });
        await mkdir(screens, { recursive: true });
        browser = await (launcher as Launcher).launch();
    }, 60_000);

    afterAll(async () => {
        await browser?.close();
        if (dist) await rm(dirname(dist), { recursive: true, force: true });
    });

    describe.each(states)("$name", (state) => {
        it.each(shots)(
            "at $width px, scale $scale",
            async ({ width, scale }) => {
                // A fresh route each time, since the running session ends for good on its own clock
                const scenarios = makeScenarios(new Date());
                const route: FakeRoute = await startFakeRoute(dist, scenarios, { liveDelayMs: 50 });
                const context = await browser.newContext({
                    viewport: { width, height: 900 },
                    deviceScaleFactor: scale,
                });
                try {
                    const page = await context.newPage();
                    const errors: string[] = [];
                    page.on("pageerror", (e) => errors.push(e.message));
                    await page.addInitScript(() => {
                        const w = window as unknown as { violations: string[] };
                        w.violations = [];
                        document.addEventListener("securitypolicyviolation", (e) => {
                            w.violations.push(`${e.effectiveDirective} ${e.blockedURI}`);
                        });
                    });
                    const { id, key } = state.link(scenarios);
                    await state.before?.(page);
                    await page.goto(`${route.origin}/s/${id}#k=${key}`);
                    await state.reach(page);
                    await page.evaluate(() => document.fonts.ready.then(() => undefined));

                    // Measured first, since a full-page shot resizes the viewport, after which
                    // Chromium drops the faces nothing on screen uses back to unloaded
                    const m = await page.evaluate(measure, fonts);
                    const file = scale === 1 ? `${width}` : `${width}@${scale}x`;
                    await page.screenshot({
                        path: join(screens, `${state.name}-${file}.png`),
                        fullPage: true,
                        animations: "disabled",
                    });

                    expect(m.overflowX).toBeLessThanOrEqual(0);
                    expect(m.edges.map((e) => e.el)).toEqual([
                        "a.logo",
                        "p.banner",
                        "div.session-head",
                        ...state.edges,
                        "footer.site",
                    ]);
                    const left = m.edges[0]!.left;
                    const starts = [...m.edges.filter((e) => e.startsLine), ...m.lines];
                    expect(m.lines.length).toBeGreaterThan(0);
                    const off = starts.filter((e) => Math.abs(e.left - left) > 0.5);
                    expect(off, `left edge ${left}`).toEqual([]);
                    expect(m.overflowing).toEqual([]);
                    expect(m.sideways).toEqual([]);
                    expect(m.shortTargets).toEqual([]);
                    expect(m.fonts).toEqual(Object.fromEntries(fonts.map((f) => [f, true])));
                    const violations = await page.evaluate(
                        () => (window as unknown as { violations: string[] }).violations,
                    );
                    expect(violations).toEqual([]);
                    expect(errors).toEqual([]);
                } finally {
                    await context.close();
                    await route.close();
                }
            },
            60_000,
        );
    });
});
