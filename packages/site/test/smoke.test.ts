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
    fake = spawn("pnpm", ["exec", "tsx", "scripts/fake-stats.ts"], {
        cwd: root,
        env: { ...process.env, STATS_PORT: String(port) },
        stdio: "ignore",
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
    fake?.kill();
});

interface Opened {
    page: Page;
    problems: string[];
}

async function open(width: number, scenario = "normal"): Promise<Opened> {
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
    await page.goto(`${site.url}/stats/`);
    await page.locator("time").first().waitFor();
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
            await page.screenshot({ path: join(dir, `${scenario}-${width}.png`), fullPage: true });
            await page.context().close();
        }
    }, 60_000);
});
