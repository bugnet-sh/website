import { readFile } from "node:fs/promises";
import { createServer, request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";

const types: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".css": "text/css",
    ".woff2": "font/woff2",
    ".svg": "image/svg+xml",
    ".txt": "text/plain",
    ".json": "application/json",
};

/** headers.txt is a path line followed by indented `Name: value` lines. */
function parseHeaders(text: string): Map<string, Record<string, string>> {
    const map = new Map<string, Record<string, string>>();
    let current: Record<string, string> | undefined;
    for (const line of text.split("\n")) {
        if (/^\S/.test(line)) {
            current = {};
            map.set(line.trim(), current);
        } else if (current && line.trim()) {
            const at = line.indexOf(":");
            current[line.slice(0, at).trim()] = line.slice(at + 1).trim();
        }
    }
    return map;
}

export interface Site {
    url: string;
    /** Which feed scenario `/api/stats*` asks the fake for. */
    scenario: string;
    close(): Promise<void>;
}

/** Serves `out/` under its real headers and forwards `/api/stats*` to the fake feed. */
export async function serveSite(out: string, fakePort: number): Promise<Site> {
    const headers = parseHeaders(await readFile(join(out, "headers.txt"), "utf8"));
    const site: Site = { url: "", scenario: "normal", close: () => Promise.resolve() };
    const server: Server = createServer((req, res) => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        if (url.pathname.startsWith("/api/stats")) {
            url.searchParams.set("scenario", site.scenario);
            const upstream = request(
                {
                    host: "127.0.0.1",
                    port: fakePort,
                    path: url.pathname + url.search,
                    method: "GET",
                },
                (answer) => {
                    res.writeHead(answer.statusCode ?? 502, answer.headers);
                    answer.pipe(res);
                },
            );
            upstream.on("error", () => res.writeHead(502).end());
            upstream.end();
            return;
        }
        const file = normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
        const path = file.endsWith("/") ? `${file}index.html` : file;
        readFile(join(out, path)).then(
            (body) => {
                res.writeHead(200, {
                    "content-type": types[extname(path)] ?? "application/octet-stream",
                    ...headers.get(file.endsWith("/") ? file : url.pathname),
                });
                res.end(body);
            },
            () => res.writeHead(404).end(),
        );
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    site.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    site.close = () => new Promise((done) => server.close(() => done()));
    return site;
}
