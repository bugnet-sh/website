import { describe, expect, it } from "vitest";
import { caddyHeaders, parseHeadersTxt, servedPaths } from "./caddy-headers";

const csp = (hash: string) =>
    `default-src 'none'; script-src 'self' 'sha256-${hash}'; frame-ancestors 'none'`;

const sample = [
    "/404.html",
    `  Content-Security-Policy: ${csp("a+b/c=")}`,
    "  Referrer-Policy: no-referrer",
    "/",
    `  Content-Security-Policy: ${csp("root+/=")}`,
    "  X-Content-Type-Options: nosniff",
    "/docs/before-you-pay/",
    `  Content-Security-Policy: ${csp("docs+/=")}`,
    "  Permissions-Policy: interest-cohort=()",
    "",
].join("\n");

/** Each matcher's quoted paths and each header block's quoted values, read back from the output. */
function readBack(caddy: string): Map<string, Map<string, string>> {
    const matchers = new Map<string, string[]>();
    const pages = new Map<string, Map<string, string>>();
    let current: Map<string, string> | undefined;
    for (const line of caddy.split("\n")) {
        const matcher = /^(@page\d+) path ((?:"[^"]*" ?)+)$/.exec(line);
        if (matcher) {
            const paths = [...(matcher[2] ?? "").matchAll(/"([^"]*)"/g)].map((m) => m[1] ?? "");
            matchers.set(matcher[1] ?? "", paths);
            continue;
        }
        const open = /^header (@page\d+) \{$/.exec(line);
        if (open) {
            current = new Map();
            for (const p of matchers.get(open[1] ?? "") ?? []) pages.set(p, current);
            continue;
        }
        const header = /^ {4}([A-Za-z0-9-]+) "([^"\\{}`]*)"$/.exec(line);
        if (header && current) current.set(header[1] ?? "", header[2] ?? "");
        else if (line === "}") current = undefined;
        else expect(line === "" || line.startsWith("#"), `unexpected line: ${line}`).toBe(true);
    }
    return pages;
}

describe("caddyHeaders", () => {
    it("carries every path and header of headers.txt, each value quoted", () => {
        const caddy = caddyHeaders(parseHeadersTxt(sample));
        const pages = readBack(caddy);
        for (const { path, headers } of parseHeadersTxt(sample)) {
            for (const served of servedPaths(path)) {
                expect([...(pages.get(served) ?? [])], served).toEqual(headers);
            }
        }
    });

    it("gives a folder page the same headers at /x, /x/ and /x/index.html", () => {
        const pages = readBack(caddyHeaders(parseHeadersTxt(sample)));
        const folder = pages.get("/docs/before-you-pay/");
        expect(folder).toBeDefined();
        expect(pages.get("/docs/before-you-pay")).toBe(folder);
        expect(pages.get("/docs/before-you-pay/index.html")).toBe(folder);
        expect(pages.get("/index.html")).toBe(pages.get("/"));
        expect(pages.has("")).toBe(false);
    });

    it("keeps a file page at its own path only", () => {
        expect(servedPaths("/404.html")).toEqual(["/404.html"]);
    });

    it.each([
        ["a quote in a value", "/", 'Content-Security-Policy: a"b'],
        ["a backslash in a value", "/", "Content-Security-Policy: a\\b"],
        ["a placeholder in a value", "/", "Content-Security-Policy: {http.request.uri}"],
        ["a control character in a value", "/", "Content-Security-Policy: a\tb"],
        ["a space in a header name", "/", "Bad Name: x"],
        ["a wildcard in a path", "/docs/*", "Referrer-Policy: no-referrer"],
        ["a quote in a path", '/a"b/', "Referrer-Policy: no-referrer"],
        ["a space in a path", "/a b/", "Referrer-Policy: no-referrer"],
    ])("refuses %s", (_, path, header) => {
        expect(() => caddyHeaders(parseHeadersTxt(`${path}\n  ${header}\n`))).toThrow();
    });

    it("refuses two pages served at one path", () => {
        const text =
            "/docs\n  Referrer-Policy: no-referrer\n/docs/\n  Referrer-Policy: no-referrer\n";
        expect(() => caddyHeaders(parseHeadersTxt(text))).toThrow(/served by two pages/);
    });

    it("refuses a header before any path", () => {
        expect(() => parseHeadersTxt("  Referrer-Policy: no-referrer\n")).toThrow();
    });
});
