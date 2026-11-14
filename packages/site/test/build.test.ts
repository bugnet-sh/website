import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { JSDOM } from "jsdom";
import { docHref, docs } from "../lib/content/docs";
import { llmsFiles } from "../lib/content/llms";
import { fakeValues } from "../lib/stats/testing/fake-data";
import { caddyHeaders, parseHeadersTxt, servedPaths } from "../scripts/caddy-headers";
import { internalRefs } from "./internal-refs";
import { beforeAll, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const site = fileURLToPath(new URL("..", import.meta.url));
const out = join(site, "out");
const fonts = ["lexend-deca-200", "manrope-400", "manrope-500", "manrope-600", "obel-mono-400"];
const licenses = ["OFL-lexend-deca.txt", "OFL-manrope.txt", "OFL-obel-mono.txt"];
const outside = ["fonts.googleapis", "fonts.gstatic", "vercel", "analytics"];
const textFile = /\.(html|css|js|json|txt|md|map|svg)$/;
const directives = [
    "base-uri",
    "connect-src",
    "default-src",
    "font-src",
    "form-action",
    "frame-ancestors",
    "img-src",
    "media-src",
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

/** A PNG's width and height, from its header. */
function pngSize(bytes: Buffer): [number, number] {
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

const html = () => files.filter((f) => f.endsWith(".html"));
const read = (file: string) => readFile(join(out, file), "utf8");
const page = async (file: string) => new JSDOM(await read(file)).window.document;
const brandFont = (font: string) => readFile(require.resolve(`@bugnet/brand/fonts/${font}.woff2`));
const ids = new Map<string, Set<string>>();
/** The ids in a built page, read once. */
async function idsOf(file: string): Promise<Set<string>> {
    if (!ids.has(file)) {
        const doc = await page(file);
        ids.set(file, new Set([...doc.querySelectorAll("[id]")].map((e) => e.id)));
    }
    return ids.get(file) as Set<string>;
}
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
    it("exports the home page, the cloud page and the stats page as folders", () => {
        expect(files).toContain("index.html");
        expect(files).toContain("cloud/index.html");
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
                // The canonical link is the one absolute URL, and it must still be ours
                ...[...doc.querySelectorAll("link[href]:not([rel=canonical])")].map((l) =>
                    l.getAttribute("href"),
                ),
                ...[...doc.querySelectorAll("script[src]")].map((s) => s.getAttribute("src")),
            ];
            const canonical = doc.querySelector("link[rel=canonical]")?.getAttribute("href");
            if (!/^(404|_not-found)/.test(file)) {
                expect(canonical, file).toBe(`https://bugnet.sh${urlPath(file)}`);
            }
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
            expect(policy.get("media-src"), path).toEqual(["'self'"]);
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

    it("exports the cloud page waiting for the feed, with no price, and Cloud marked current", async () => {
        const doc = await page("cloud/index.html");
        const current = [...doc.querySelectorAll('header [aria-current="page"]')];
        expect(current.map((a) => a.getAttribute("href"))).toEqual(["/cloud/", "/cloud/"]);
        // Prices come only from the live feed (founder D13, 2026-11-13)
        expect(doc.querySelectorAll("main article")).toHaveLength(0);
        expect(doc.querySelectorAll("main .animate-pulse").length).toBeGreaterThan(0);
        expect(doc.querySelector("main")?.textContent).not.toMatch(/USDC/);
    });

    it("hides the bar of each On this page rail, which still scrolls", async () => {
        const css = (
            await Promise.all(files.filter((f) => f.endsWith(".css")).map((f) => read(f)))
        ).join("\n");
        expect(css).toMatch(/\.scrollbar-hidden\{[^}]*scrollbar-width:none/);
        expect(css).toMatch(/\.scrollbar-hidden::-webkit-scrollbar\{display:none\}/);
        for (const file of ["privacy/index.html", "docs/index.html"]) {
            const toc = (await page(file)).querySelector("nav[aria-labelledby='on-this-page']");
            const rail = toc?.closest("aside")?.className.split(" ") ?? [];
            expect(rail, file).toEqual(
                expect.arrayContaining(["overflow-y-auto", "scrollbar-hidden"]),
            );
        }
    });

    it("has inline scripts on the stats page for the policy to hash", async () => {
        const doc = await page("stats/index.html");
        expect(doc.querySelectorAll("script:not([src])").length).toBeGreaterThan(0);
    });

    it("names none of the team's own files, notes or sessions in the docs it ships", async () => {
        const pages = html().filter((f) => f.startsWith("docs/"));
        expect(pages).toHaveLength(docs.length);
        for (const file of pages) {
            const main = (await page(file)).querySelector("main");
            expect(main, file).not.toBeNull();
            expect(internalRefs(main?.textContent ?? ""), file).toEqual([]);
        }
        const texts = files.filter((f) =>
            /^(docs\/.*\.md|llms.*\.txt|search-index\.json)$/.test(f),
        );
        expect(texts).toContain("search-index.json");
        for (const file of texts) expect(internalRefs(await read(file)), file).toEqual([]);
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

    it("ships llms.txt, llms-full.txt and each docs page as Markdown, as the docs give them", async () => {
        const written = llmsFiles(join(site, "content/docs"));
        for (const [path, text] of written) expect(await read(path.slice(1)), path).toBe(text);
        expect(files.filter((f) => f.endsWith(".md"))).toEqual(
            [...written.keys()]
                .filter((path) => path.endsWith(".md"))
                .map((path) => path.slice(1))
                .sort(),
        );
    });

    it("links llms.txt and the Markdown only to files and anchors that exist", async () => {
        const texts = files.filter((f) => /^(llms(-full)?\.txt|docs\/[^/]+\.md)$/.test(f));
        expect(texts).toHaveLength(docs.length + 2);
        let checked = 0;
        for (const file of texts) {
            for (const [url] of (await read(file)).matchAll(
                /https:\/\/bugnet\.sh\/[^\s)<>`"'\]]*/g,
            )) {
                const { pathname, hash } = new URL(url);
                const target = pathname.endsWith("/")
                    ? `${pathname.slice(1)}index.html`
                    : pathname.slice(1);
                expect(files, `${file}: ${url}`).toContain(target);
                if (hash.length > 1) {
                    const id = decodeURIComponent(hash.slice(1));
                    expect([...(await idsOf(target))], `${file}: ${url}`).toContain(id);
                }
                checked++;
            }
        }
        expect(checked).toBeGreaterThan(50);
    });

    it("puts one Copy Markdown button in each docs page's title row", async () => {
        for (const file of html().filter((f) => f.startsWith("docs/"))) {
            const doc = await page(file);
            const buttons = [...doc.querySelectorAll('button[aria-label="Copy Markdown"]')];
            expect(buttons, file).toHaveLength(1);
            const row = doc.querySelector("main h1")?.parentElement;
            expect(row?.contains(buttons[0] ?? null), file).toBe(true);
        }
    });

    it("ships robots.txt, a sitemap whose every URL is a file, and the icons", async () => {
        expect(await read("robots.txt")).toContain("Sitemap: https://bugnet.sh/sitemap.xml");
        const urls = [...(await read("sitemap.xml")).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
            (m) => m[1] ?? "",
        );
        const expected = ["/", "/cloud/", "/stats/", ...docs.map(docHref), "/terms/", "/privacy/"];
        expect(urls.sort()).toEqual(expected.map((p) => `https://bugnet.sh${p}`).sort());
        for (const url of urls) {
            const { pathname } = new URL(url);
            expect(files, url).toContain(`${pathname.slice(1)}index.html`);
        }
        expect(files).toContain("icon.svg");
        expect(files).toContain("404.html");
        const apple = files.filter((f) => /^apple-icon\.[\w-]*\.?png$/.test(f));
        expect(apple).toHaveLength(1);
        expect(pngSize(await readFile(join(out, apple[0] ?? "")))).toEqual([180, 180]);
    });

    it("ships one 1200 by 630 PNG share image, named in the meta of the main pages", async () => {
        expect(pngSize(await readFile(join(out, "og.png")))).toEqual([1200, 630]);
        for (const file of [
            "index.html",
            "cloud/index.html",
            "stats/index.html",
            "docs/index.html",
        ]) {
            const doc = await page(file);
            const meta = (selector: string) => doc.querySelector(selector)?.getAttribute("content");
            expect(meta('meta[property="og:image"]'), file).toBe("https://bugnet.sh/og.png");
            expect(meta('meta[name="twitter:card"]'), file).toBe("summary_large_image");
            expect(meta('meta[name="description"]'), file).toBeTruthy();
            expect(doc.querySelector('link[rel="canonical"]'), file).not.toBeNull();
        }
    });
});
