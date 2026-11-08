import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../out", import.meta.url));
const require = createRequire(import.meta.url);
const licenses = ["OFL-lexend-deca.txt", "OFL-manrope.txt", "OFL-obel-mono.txt"];

// Script text never holds "</script", so the first one closes the element
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const HAS_SRC = /\ssrc\s*=/i;

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
    const path = `/${file.split(sep).join("/")}`;
    return path.endsWith("/index.html") ? path.slice(0, -"index.html".length) : path;
}

/** The CSP source for each inline script, so the page runs without `'unsafe-inline'`. */
function inlineScriptHashes(html: string): string[] {
    const hashes = new Set<string>();
    for (const [, attributes = "", body = ""] of html.matchAll(SCRIPT)) {
        if (HAS_SRC.test(attributes)) continue;
        hashes.add(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
    }
    return [...hashes].sort();
}

function policy(hashes: readonly string[]): string {
    return [
        "default-src 'none'",
        ["script-src 'self'", ...hashes].join(" "),
        // Recharts positions its tooltip and legend with style attributes
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        "img-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'none'",
    ].join("; ");
}

function block(path: string, hashes: readonly string[]): string {
    return [
        path,
        `  Content-Security-Policy: ${policy(hashes)}`,
        "  Referrer-Policy: no-referrer",
        "  X-Content-Type-Options: nosniff",
        "  Permissions-Policy: interest-cohort=()",
    ].join("\n");
}

async function main(): Promise<void> {
    const pages = (await walk(out))
        .filter((f) => f.endsWith(".html"))
        .map((f) => relative(out, f))
        .sort();
    const blocks = await Promise.all(
        pages.map(async (page) =>
            block(urlPath(page), inlineScriptHashes(await readFile(join(out, page), "utf8"))),
        ),
    );
    await writeFile(join(out, "headers.txt"), `${blocks.join("\n")}\n`);

    // The bundler ships the fonts themselves; the OFL asks that their licences travel with them
    await mkdir(join(out, "fonts"), { recursive: true });
    await Promise.all(
        licenses.map((name) =>
            copyFile(require.resolve(`@bugnet/brand/fonts/${name}`), join(out, "fonts", name)),
        ),
    );
}

await main();
