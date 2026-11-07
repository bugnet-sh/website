import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { JSDOM } from "jsdom";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPage, fillTemplate, headersFile } from "./build.ts";
import { makeScenarios, sampleStrings } from "./testing/fixtures.ts";

const require = createRequire(import.meta.url);
const brand = (name: string) => readFile(require.resolve(`@bugnet/brand/${name}`));
const fonts = ["lexend-deca-200", "manrope-400", "manrope-600", "obel-mono-400"];

let root = "";
let out = "";
let built: string[] = [];
let html = "";
let doc: Document;

async function walk(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map((e) =>
            e.isDirectory() ? walk(join(dir, e.name)) : Promise.resolve([join(dir, e.name)]),
        ),
    );
    return nested.flat();
}

const files = async () => (await walk(out)).map((f) => relative(out, f)).sort();
const sha384 = (bytes: Uint8Array) =>
    `sha384-${createHash("sha384").update(bytes).digest("base64")}`;
const asset = (href: string | null | undefined) => readFile(join(out, href ?? "missing"));

beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "bugnet-session-page-build-"));
    out = join(root, "dist");
    built = (await buildPage({ outdir: out })).files;
    html = await readFile(join(out, "index.html"), "utf8");
    doc = new JSDOM(html).window.document;
}, 60_000);

afterAll(async () => {
    if (root) await rm(root, { recursive: true, force: true });
});

describe("buildPage", () => {
    it("writes exactly the page, its headers and the hashed assets", async () => {
        const names = await files();
        expect(built.slice().sort()).toEqual(names);
        const expected = [
            /^assets\/icon-[A-Z0-9]{8}\.svg$/,
            ...fonts.map((f) => new RegExp(`^assets/${f}-[A-Z0-9]{8}\\.woff2$`)),
            /^assets\/page-[A-Z0-9]{8}\.css$/,
            /^assets\/page-[A-Z0-9]{8}\.js$/,
            /^headers\.txt$/,
            /^index\.html$/,
        ];
        expect(names).toHaveLength(expected.length);
        // Each name once, in any order, since the hashes decide how page-*.css and page-*.js sort
        for (const pattern of expected) {
            expect(
                names.filter((n) => pattern.test(n)),
                String(pattern),
            ).toHaveLength(1);
        }
    });

    it("pins the script and the style by their SHA-384", async () => {
        const style = doc.querySelector('link[rel="stylesheet"]');
        const script = doc.querySelector("script");
        expect(style?.getAttribute("href")).toMatch(/^\/assets\/page-[A-Z0-9]{8}\.css$/);
        expect(script?.getAttribute("src")).toMatch(/^\/assets\/page-[A-Z0-9]{8}\.js$/);
        expect(style?.getAttribute("integrity")).toBe(
            sha384(await asset(style?.getAttribute("href"))),
        );
        expect(script?.getAttribute("integrity")).toBe(
            sha384(await asset(script?.getAttribute("src"))),
        );
    });

    it("fills every placeholder", async () => {
        expect(html).not.toContain("__");
        expect(html).not.toContain("<!--");
        const icon = doc.querySelector('link[rel="icon"]')?.getAttribute("href");
        expect(icon).toMatch(/^\/assets\/icon-[A-Z0-9]{8}\.svg$/);
        expect(await asset(icon)).toEqual(await brand("icon.svg"));
    });

    it("preloads the four brand fonts the stylesheet uses", async () => {
        const preloads = [...doc.querySelectorAll('link[rel="preload"]')];
        expect(preloads).toHaveLength(4);
        for (const link of preloads) {
            expect(link.getAttribute("as")).toBe("font");
            expect(link.getAttribute("type")).toBe("font/woff2");
            expect(link.hasAttribute("crossorigin")).toBe(true);
        }
        const hrefs = preloads.map((l) => l.getAttribute("href") ?? "");
        const css = (
            await asset(doc.querySelector('link[rel="stylesheet"]')?.getAttribute("href"))
        ).toString("utf8");
        for (const [i, font] of fonts.entries()) {
            const href = hrefs[i] ?? "";
            expect(href).toMatch(new RegExp(`^/assets/${font}-[A-Z0-9]{8}\\.woff2$`));
            expect(await asset(href)).toEqual(await brand(`fonts/${font}.woff2`));
            expect(css).toContain(`url("./${href.slice("/assets/".length)}")`);
        }
    });

    it("puts the brand logo in the home link, hidden, since the link carries the name", () => {
        const link = doc.querySelector("header.site a.logo")!;
        const svg = link.querySelector(":scope > svg")!;
        expect(link.getAttribute("aria-label")).toBe("Bugnet");
        expect(svg.getAttribute("aria-hidden")).toBe("true");
        expect(svg.getAttribute("focusable")).toBe("false");
        expect(svg.hasAttribute("role")).toBe(false);
        expect(svg.hasAttribute("aria-label")).toBe(false);
        expect(svg.getAttribute("viewBox")).toBe("320 264 608 693");
        expect(svg.querySelectorAll("path")).toHaveLength(5);
    });

    it("copies headers.txt as it is", async () => {
        expect(headersFile).toBe("headers.txt");
        expect(await readFile(join(out, headersFile), "utf8")).toBe(
            [
                "Cache-Control: no-store",
                "Referrer-Policy: no-referrer",
                "X-Content-Type-Options: nosniff",
                "Cross-Origin-Opener-Policy: same-origin",
                "X-Robots-Tag: noindex, nofollow, noarchive",
                "Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; require-trusted-types-for 'script'; trusted-types 'none'",
                "",
            ].join("\n"),
        );
    });

    it("ships no sample text", async () => {
        const samples = sampleStrings(makeScenarios(new Date()));
        expect(samples).toContain("zz-sample-ended-full");
        expect(samples).toContain("npm ci --no-audit --no-fund");
        expect(samples).toContain("weather-api.example");
        for (const name of await files()) {
            const text = await readFile(join(out, name), "utf8");
            expect(text, name).not.toMatch(/fixture/i);
            for (const sample of samples)
                expect(text.includes(sample), `${name}: ${sample}`).toBe(false);
        }
    });

    it("sets no HTML from script", async () => {
        const src = doc.querySelector("script")?.getAttribute("src");
        expect((await asset(src)).toString("utf8")).not.toContain("innerHTML");
    });
});

describe("fillTemplate", () => {
    it("fills each placeholder with its value, as text", () => {
        expect(fillTemplate("<a>__A__</a><!--B-->", { __A__: "$&1", "<!--B-->": "<b></b>" })).toBe(
            "<a>$&1</a><b></b>",
        );
    });

    it("fails on a placeholder left unfilled or one the page lacks", () => {
        expect(() => fillTemplate("<a>__A__</a>__C__", { __A__: "1" })).toThrow(/unfilled/);
        expect(() => fillTemplate("<a>__A__</a><!--D-->", { __A__: "1" })).toThrow(/unfilled/);
        expect(() => fillTemplate("<a></a>", { __A__: "1" })).toThrow(/has no __A__/);
    });
});
