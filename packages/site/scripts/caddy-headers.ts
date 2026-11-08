import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** One page's headers from `headers.txt`, in file order. */
export interface HeaderBlock {
    path: string;
    headers: [name: string, value: string][];
}

// Anything outside these sets could end a quoted Caddyfile token, start a placeholder, or turn a
// path matcher into a wildcard, so it fails the build instead of being escaped
const SAFE_PATH = /^\/[A-Za-z0-9._~/-]*$/;
const SAFE_NAME = /^[A-Za-z0-9-]+$/;
const SAFE_VALUE = /^[\x20-\x7e]*$/;
const UNSAFE_IN_VALUE = /["\\{}`]/;

/** `headers.txt`: a path on its own line, then its headers indented by two spaces. */
export function parseHeadersTxt(text: string): HeaderBlock[] {
    const blocks: HeaderBlock[] = [];
    for (const line of text.split("\n")) {
        if (line === "") continue;
        if (line.startsWith("  ")) {
            const current = blocks.at(-1);
            const at = line.indexOf(": ");
            if (!current || at < 0) throw new Error(`headers.txt: stray line ${line}`);
            current.headers.push([line.slice(2, at), line.slice(at + 2)]);
        } else {
            blocks.push({ path: line, headers: [] });
        }
    }
    return blocks;
}

/**
 * The request paths that serve one page. try_files serves `/x/` at `/x`, `/x/` and
 * `/x/index.html`, and `header` runs before that rewrite, so it matches all three.
 */
export function servedPaths(path: string): string[] {
    if (path === "/") return ["/", "/index.html"];
    if (path.endsWith("/")) return [path.slice(0, -1), path, `${path}index.html`];
    return [path];
}

function quote(token: string, what: string): string {
    if (!SAFE_VALUE.test(token) || UNSAFE_IN_VALUE.test(token)) {
        throw new Error(`headers.txt: ${what} cannot be quoted safely: ${token}`);
    }
    return `"${token}"`;
}

/** A named matcher and a `header` block per page, for `import` inside a Caddy site block. */
export function caddyHeaders(blocks: readonly HeaderBlock[]): string {
    const seen = new Set<string>();
    const lines = ["# Written by scripts/caddy-headers.ts from headers.txt. Do not edit."];
    blocks.forEach(({ path, headers }, i) => {
        if (!SAFE_PATH.test(path)) throw new Error(`headers.txt: unsafe path ${path}`);
        if (headers.length === 0) throw new Error(`headers.txt: ${path} has no headers`);
        const paths = servedPaths(path);
        for (const p of paths) {
            if (seen.has(p)) throw new Error(`headers.txt: ${p} is served by two pages`);
            seen.add(p);
        }
        const matcher = `@page${i}`;
        lines.push("", `${matcher} path ${paths.map((p) => quote(p, "path")).join(" ")}`);
        lines.push(`header ${matcher} {`);
        for (const [name, value] of headers) {
            if (!SAFE_NAME.test(name)) throw new Error(`headers.txt: unsafe header name ${name}`);
            lines.push(`    ${name} ${quote(value, `${name} on ${path}`)}`);
        }
        lines.push("}");
    });
    return `${lines.join("\n")}\n`;
}

/** Writes `out/headers.caddy` from `out/headers.txt`. */
export async function writeCaddyHeaders(out: string): Promise<void> {
    const text = await readFile(join(out, "headers.txt"), "utf8");
    await writeFile(join(out, "headers.caddy"), caddyHeaders(parseHeadersTxt(text)));
}
