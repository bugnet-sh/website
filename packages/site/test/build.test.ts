import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { JSDOM } from "jsdom";
import { fakeValues } from "../lib/stats/testing/fake-data";
import { caddyHeaders, parseHeadersTxt, servedPaths } from "../scripts/caddy-headers";
import { beforeAll, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const site = fileURLToPath(new URL("..", import.meta.url));
const out = join(site, "out");
const fonts = ["lexend-deca-200", "manrope-400", "manrope-600", "obel-mono-400"];
const licenses = ["OFL-lexend-deca.txt", "OFL-manrope.txt", "OFL-obel-mono.txt"];
const outside = ["fonts.googleapis", "fonts.gstatic", "vercel", "analytics"];
const textFile = /\.(html|css|js|json|txt|map|svg)$/;
const directives = [
    "base-uri",
    "connect-src",
    "default-src",
    "font-src",
    "form-action",
    "frame-ancestors",
    "img-src",
    "script-src",
    "style-src",
];

/** Every file under out/, as a URL-style path such as `stats/index.html`. */
let files: string[] = [];
let headers = new Map<string, Map<string, string>>();

async function walk(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map((e) =>
            e.isDirectory() ? walk(join(dir, e.name)) : Promise.resolve([join(dir, e.name)]),
        ),
    );
    return nested.flat();
}

/** The URL path a file is served at: `stats/index.html` is `/stats/`. */
function urlPath(file: string): string {
    const path = `/${file}`;
    return path.endsWith("/index.html") ? path.slice(0, -"index.html".length) : path;
}

/** `headers.txt`: a path on its own line, then its headers indented by two spaces. */
function parseHeaders(text: string): Map<string, Map<string, string>> {
    const blocks = new Map<string, Map<string, string>>();
    let current: Map<string, string> | undefined;
    for (const line of text.split("\n")) {
        if (line === "") continue;
        if (line.startsWith("  ")) {
            expect(current, `a header before any path: ${line}`).toBeDefined();
            const at = line.indexOf(": ");
            current?.set(line.slice(2, at), line.slice(at + 2));
        } else {
            current = new Map();
            blocks.set(line, current);
        }
    }
    return blocks;
}

function csp(path: string): Map<string, string[]> {
    const value = headers.get(path)?.get("Content-Security-Policy") ?? "";
    return new Map(
        value
            .split(";")
            .map((d) => d.trim().split(/\s+/))
            .filter((d) => d[0])
            .map(([name, ...values]) => [name as string, values]),
    );
}

const html = () => files.filter((f) => f.endsWith(".html"));
const read = (file: string) => readFile(join(out, file), "utf8");
const page = async (file: string) => new JSDOM(await read(file)).window.document;
const brandFont = (font: string) => readFile(require.resolve(`@bugnet/brand/fonts/${font}.woff2`));
const sha256 = (text: string) =>
    `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;

beforeAll(async () => {
    // A filter that matches no package still exits 0, so an old out/ must not pass for a build
    await rm(out, { recursive: true, force: true });
    await promisify(execFile)("pnpm", ["--filter", "@bugnet/site", "build"], {
        cwd: site,
        maxBuffer: 64 * 1024 * 1024,
    });
    files = (await walk(out)).map((f) => relative(out, f).split(sep).join("/")).sort();
    headers = parseHeaders(await read("headers.txt"));
}, 300_000);

describe("next build", () => {
    it("exports the home page and the stats page as folders", () => {
        expect(files).toContain("index.html");
        expect(files).toContain("stats/index.html");
        expect(files.some((f) => f.startsWith("_next/static/"))).toBe(true);
    });

    it("ships each brand font once, with the licences", async () => {
        for (const font of fonts) {
            // The bundler names each file after its source and a content hash
            const shipped = files.filter((f) =>
                new RegExp(`^_next/static/media/${font}\\.[\\w-]+\\.woff2$`).test(f),
            );
            expect(shipped, font).toHaveLength(1);
            expect(await readFile(join(out, shipped[0] ?? "")), font).toEqual(
                await brandFont(font),
            );
        }
        for (const license of licenses) expect(files).toContain(`fonts/${license}`);
    });

    it("loads every stylesheet, script and preload from our own origin", async () => {
        for (const file of html()) {
            const doc = await page(file);
            const urls = [
                ...[...doc.querySelectorAll("link[href]")].map((l) => l.getAttribute("href")),
                ...[...doc.querySelectorAll("script[src]")].map((s) => s.getAttribute("src")),
            ];
            expect(urls.length, file).toBeGreaterThan(0);
            for (const url of urls) {
                expect(url, file).not.toMatch(/^(https?:)?\/\//i);
                const base = `https://bugnet.sh${urlPath(file)}`;
                expect(new URL(url ?? "", base).origin, `${file}: ${url}`).toBe(
                    "https://bugnet.sh",
                );
            }
        }
    });

    it("preloads exactly the font files its stylesheet asks for", async () => {
        const used = new Set<string>();
        for (const file of files.filter((f) => f.endsWith(".css"))) {
            const sheet = new URL(urlPath(file), "https://bugnet.sh");
            for (const [, url = ""] of (await read(file)).matchAll(/url\(\s*["']?([^"')]+)/g)) {
                if (url.endsWith(".woff2")) used.add(new URL(url, sheet).pathname);
            }
        }
        expect(used.size).toBe(fonts.length);
        for (const file of html()) {
            const preloads = [...(await page(file)).querySelectorAll('link[rel="preload"]')]
                .filter((l) => l.getAttribute("as") === "font")
                .map((l) => ["href", "type", "crossorigin"].map((name) => l.getAttribute(name)));
            expect(preloads.sort(), file).toEqual(
                [...used].sort().map((href) => [href, "font/woff2", ""]),
            );
        }
    });

    it("names no outside font host, vercel or analytics anywhere", async () => {
        for (const file of files.filter((f) => textFile.test(f))) {
            // The privacy notice says the site "runs no analytics", which is the point
            const text = (await read(file)).toLowerCase().replaceAll("no analytics", "");
            for (const word of outside) expect(text.includes(word), `${file}: ${word}`).toBe(false);
        }
    });

    it("writes the headers of every page, and of nothing else", () => {
        expect([...headers.keys()].sort()).toEqual(html().map(urlPath).sort());
        for (const [path, block] of headers) {
            expect([...block.keys()].sort(), path).toEqual([
                "Content-Security-Policy",
                "Permissions-Policy",
                "Referrer-Policy",
                "X-Content-Type-Options",
            ]);
            expect(block.get("Referrer-Policy"), path).toBe("no-referrer");
            expect(block.get("X-Content-Type-Options"), path).toBe("nosniff");
            expect(block.get("Permissions-Policy"), path).toBe("interest-cohort=()");
        }
    });

    it("writes the same headers for Caddy, at every path that serves each page", async () => {
        const caddy = await read("headers.caddy");
        expect(caddy).toBe(caddyHeaders(parseHeadersTxt(await read("headers.txt"))));
        for (const [path, block] of headers) {
            for (const served of servedPaths(path)) expect(caddy).toContain(`"${served}"`);
            for (const value of block.values()) expect(caddy).toContain(`"${value}"`);
        }
    });

    it("locks each page down to its own origin and its own inline scripts", async () => {
        for (const file of html()) {
            const path = urlPath(file);
            const policy = csp(path);
            const inline = [...(await page(file)).querySelectorAll("script:not([src])")].map((s) =>
                sha256(s.textContent ?? ""),
            );
            expect([...policy.keys()].sort(), path).toEqual(directives);
            expect(policy.get("default-src"), path).toEqual(["'none'"]);
            expect(policy.get("script-src"), path).toEqual(["'self'", ...new Set(inline.sort())]);
            // Recharts sets style attributes, so inline styles have to be allowed
            expect(policy.get("style-src"), path).toEqual(["'self'", "'unsafe-inline'"]);
            expect(policy.get("font-src"), path).toEqual(["'self'"]);
            expect(policy.get("img-src"), path).toEqual(["'self'", "data:"]);
            expect(policy.get("connect-src"), path).toEqual(["'self'"]);
            expect(policy.get("frame-ancestors"), path).toEqual(["'none'"]);
            expect(policy.get("base-uri"), path).toEqual(["'none'"]);
            expect(policy.get("form-action"), path).toEqual(["'none'"]);
        }
    });

    it("marks Home as the current page on the home page, and nothing on the stats page", async () => {
        const home = await page("index.html");
        const current = [...home.querySelectorAll('header [aria-current="page"]')];
        expect(current.length).toBeGreaterThan(0);
        for (const link of current) {
            expect(link.textContent).toBe("Home");
            expect(link.getAttribute("href")).toBe("/");
        }
        const stats = await page("stats/index.html");
        expect(stats.querySelector("header")).not.toBeNull();
        expect(stats.querySelectorAll("[aria-current]")).toHaveLength(0);
    });

    it("has inline scripts on the stats page for the policy to hash", async () => {
        const doc = await page("stats/index.html");
        expect(doc.querySelectorAll("script:not([src])").length).toBeGreaterThan(0);
    });

    it("ships none of the fake stats values", async () => {
        for (const file of files.filter((f) => textFile.test(f))) {
            const text = await read(file);
            for (const value of fakeValues) {
                expect(text.includes(value), `${file}: ${value.slice(0, 20)}`).toBe(false);
            }
        }
    });

    it("links only to files and anchors that exist", async () => {
        const ids = new Map<string, Set<string>>();
        const idsOf = async (file: string) => {
            if (!ids.has(file)) {
                const doc = await page(file);
                ids.set(file, new Set([...doc.querySelectorAll("[id]")].map((e) => e.id)));
            }
            return ids.get(file) as Set<string>;
        };
        let checked = 0;
        for (const file of html()) {
            const doc = await page(file);
            for (const a of doc.querySelectorAll("a[href^='/']")) {
                const href = a.getAttribute("href") ?? "";
                if (href.startsWith("//")) continue;
                const { pathname, hash } = new URL(href, "https://bugnet.sh");
                const target = pathname.endsWith("/")
                    ? `${pathname.slice(1)}index.html`
                    : pathname.slice(1);
                expect(files, `${file}: ${href}`).toContain(target);
                if (hash.length > 1 && target.endsWith(".html")) {
                    const id = decodeURIComponent(hash.slice(1));
                    expect([...(await idsOf(target))], `${file}: ${href}`).toContain(id);
                }
                checked++;
            }
        }
        expect(checked).toBeGreaterThan(20);
    });
});
