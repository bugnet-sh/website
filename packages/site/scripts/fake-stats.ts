import { createServer } from "node:http";
import {
    fakePayments,
    fakeSessions,
    fakeSummary,
    scenarios,
    type Scenario,
} from "../lib/stats/testing/fake-data";

// The fake the page is built against: GET /api/stats, /api/stats/sessions, /api/stats/payments
const port = Number(process.env.STATS_PORT ?? 8461);
const fallback = (process.env.STATS_SCENARIO ?? "normal") as Scenario;
const seed = 7;

createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const asked = url.searchParams.get("scenario") as Scenario | null;
    const scenario = asked && scenarios.includes(asked) ? asked : fallback;
    const before = url.searchParams.get("before") ?? undefined;
    const body =
        url.pathname === "/api/stats"
            ? fakeSummary(seed, scenario, new Date())
            : url.pathname === "/api/stats/sessions"
              ? fakeSessions(seed, scenario, before)
              : url.pathname === "/api/stats/payments"
                ? fakePayments(seed, scenario, before)
                : undefined;
    if (body === undefined) {
        res.writeHead(404).end();
    } else if (body === null) {
        res.writeHead(503, { "content-type": "application/json" });
        res.end('{"error":"unavailable"}');
    } else {
        res.writeHead(200, {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
        });
        res.end(JSON.stringify(body));
    }
}).listen(port, "127.0.0.1", () => console.log(`fake stats on 127.0.0.1:${port} (${fallback})`));
