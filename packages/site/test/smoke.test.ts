/**
 * Drives the built site in Chromium under its real CSP, against the fake stats feed. One
 * browser, closed at the end; the screenshots are for a human to look at (screens/ is ignored).
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright-core";
import { serveSite, type Site } from "./serve";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

let browser: Browser;
let site: Site;
let fake: ChildProcess;

async function freePort(): Promise<number> {
    const probe = createServer();
    await new Promise<void>((done) => probe.listen(0, "127.0.0.1", done));
    const port = (probe.address() as { port: number }).port;
    await new Promise((done) => probe.close(done));
    return port;
}

beforeAll(async () => {
    const port = await freePort();
    // Spawned directly and detached, so afterAll can stop the whole group; killing a pnpm
    // wrapper leaves the tsx child running
    fake = spawn(join(root, "..", "..", "node_modules", ".bin", "tsx"), ["scripts/fake-stats.ts"], {
        cwd: root,
        env: { ...process.env, STATS_PORT: String(port) },
        stdio: "ignore",
        detached: true,
    });
    for (let tries = 0; tries < 100; tries++) {
        const up = await fetch(`http://127.0.0.1:${port}/api/stats`).then(
            () => true,
            () => false,
        );
        if (up) break;
        await new Promise((done) => setTimeout(done, 100));
    }
    site = await serveSite(join(root, "out"), port);
    try {
        browser = await chromium.launch();
    } catch {
        browser = await chromium.launch({ executablePath: chrome });
    }
}, 60_000);

afterAll(async () => {
    await browser?.close();
    await site?.close();
    try {
        if (fake?.pid) process.kill(-fake.pid, "SIGTERM");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
});

interface Opened {
    page: Page;
    problems: string[];
}

async function open(width: number, scenario = "normal", path = "/stats/"): Promise<Opened> {
    site.scenario = scenario;
    const page = await (await browser.newContext()).newPage();
    await page.setViewportSize({ width, height: 900 });
    const problems: string[] = [];
    page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
    page.on("pageerror", (e) => problems.push(e.message));
    await page.addInitScript(() => {
        document.addEventListener("securitypolicyviolation", (e) =>
            console.error(`CSP: ${e.violatedDirective} ${e.blockedURI}`),
        );
    });
    await page.goto(`${site.url}${path}`);
    if (path === "/stats/") await page.locator("time").first().waitFor();
    return { page, problems };
}

const left = (page: Page, selector: string) =>
    page
        .locator(selector)
        .first()
        .evaluate((el) => el.getBoundingClientRect().left);

describe.skipIf(!existsSync(join(root, "out", "headers.txt")))("stats page in Chromium", () => {
    it("lines up and stays quiet at 1440", async () => {
        const { page, problems } = await open(1440);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
            1440,
        );
        const logo = await left(page, "header a[href='/']");
        expect(await left(page, "h1")).toBe(logo);
        expect(await left(page, "footer svg")).toBe(logo);
        await page.locator(".recharts-wrapper").first().click();
        const outline = await page.evaluate(
            () => getComputedStyle(document.activeElement!).outlineStyle,
        );
        expect(outline).toBe("none");
        expect(problems).toEqual([]);
    });

    it("fits at 375 and opens and closes the menu", async () => {
        const { page, problems } = await open(375);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
            375,
        );
        const menu = page.getByRole("button", { name: "Menu" });
        await menu.click();
        expect(await menu.getAttribute("aria-expanded")).toBe("true");
        await page.keyboard.press("Escape");
        expect(await menu.getAttribute("aria-expanded")).toBe("false");
        expect(problems).toEqual([]);
    });

    it("writes screenshots for a human to look at", async () => {
        const dir = join(root, "screens");
        await mkdir(dir, { recursive: true });
        for (const [scenario, width] of [
            ["normal", 1440],
            ["normal", 860],
            ["normal", 375],
            ["hostile", 375],
        ] as const) {
            const { page } = await open(width, scenario);
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth),
            ).toBeLessThanOrEqual(width);
            await page.screenshot({ path: join(dir, `${scenario}-${width}.png`), fullPage: true });
            await page.context().close();
        }
    }, 60_000);
});

const pages = ["/", "/docs/", "/docs/paying/", "/privacy/"];

describe.skipIf(!existsSync(join(root, "out", "headers.txt")))("content pages in Chromium", () => {
    for (const width of [1440, 375]) {
        it(`are quiet and fit at ${width}`, async () => {
            for (const path of pages) {
                const { page, problems } = await open(width, "normal", path);
                await page.waitForLoadState("networkidle");
                const wide = await page.evaluate(() => document.documentElement.scrollWidth);
                expect(wide, path).toBeLessThanOrEqual(width);
                if (width === 1440) {
                    const logo = await left(page, "header a[href='/']");
                    // Docs pages open with the sidebar in the first column, the H1 in the next
                    const first = path.startsWith("/docs/") ? "[aria-label='Docs']" : "h1";
                    expect(await left(page, first), path).toBe(logo);
                    expect(await left(page, "footer svg"), path).toBe(logo);
                }
                expect(problems, path).toEqual([]);
                const dir = join(root, "screens");
                await mkdir(dir, { recursive: true });
                const name = path.replaceAll("/", "-").replace(/^-|-$/g, "") || "home";
                await page.screenshot({ path: join(dir, `${name}-${width}.png`), fullPage: true });
                await page.context().close();
            }
        }, 60_000);
    }

    it("searches the docs and opens the menu at 375", async () => {
        const wide = await open(1440, "normal", "/docs/");
        const box = wide.page.getByRole("combobox", { name: "Search the docs" });
        await box.fill("refund");
        await wide.page.getByRole("option").first().waitFor();
        await Promise.all([
            wide.page.waitForURL((url) => url.pathname !== "/docs/"),
            box.press("Enter"),
        ]);
        expect(wide.problems).toEqual([]);
        await wide.page.context().close();

        const { page, problems } = await open(375, "normal", "/docs/");
        const menu = page.getByRole("button", { name: "Docs menu" });
        await menu.click();
        expect(await menu.getAttribute("aria-expanded")).toBe("true");
        await page.getByRole("combobox", { name: "Search the docs" }).waitFor({ state: "visible" });
        expect(problems).toEqual([]);
        await page.context().close();
    });
});
