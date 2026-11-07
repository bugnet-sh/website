import { describe, expect, it } from "vitest";
import { formatClock } from "../format.ts";
import { parseGetBody, type SessionEvent, type SessionRecord } from "../payload.ts";
import { makeScenarios, sampleTx, type ScenarioName } from "../testing/fixtures.ts";
import {
    buildMap,
    MAX_PREVIEWS,
    MAX_RIGHT,
    settlingCalls,
    type MapModel,
    type MapNode,
} from "./model.ts";

const scenarios = makeScenarios(new Date("2026-11-06T12:00:00Z"));

function recordOf(name: ScenarioName, answer = 0): SessionRecord {
    const body = parseGetBody(scenarios[name].gets[answer]!.body);
    if (body.state !== "ended") throw new Error(`expected ended, got ${body.state}`);
    return body.record;
}

function nodeOf(model: MapModel, id: string): MapNode {
    const node = model.nodes.find((n) => n.id === id);
    if (!node) throw new Error(`no node ${id}`);
    return node;
}

// Values hold no-break spaces, which these expectations write as plain ones
const plain = (s: string) => s.replaceAll("\u00a0", " ");
const metric = (node: MapNode) => node.metricParts.map((p) => plain(p.text));
const texts = (node: MapNode) => node.rows.map((r) => [r.event, r.detail.map(plain), r.tone]);

describe("buildMap on the sample sessions", () => {
    it("places ended-full's nodes in order, with their counts and metrics", () => {
        const model = buildMap(recordOf("ended-full"));
        expect(model.nodes.map((n) => [n.kind, n.side, n.label, n.count, metric(n)])).toEqual([
            ["sandbox", "center", "Sandbox", 4, ["2 vCPU", "2 GiB", "15 min"]],
            ["mcp", "left", "Bugnet MCP", 19, ["19 tool calls"]],
            ["payments", "left", "Payments", 2, ["0.075 USDC paid"]],
            ["allowance", "left", "Allowance", 2, ["0.05 USDC", "paid in"]],
            ["secret-host", "right", "api.github.com", 6, ["6 requests"]],
            ["x402-host", "right", "search-api.example", 5, ["5 calls", "0.024 USDC"]],
            ["secret-host", "right", "huggingface.co", 3, ["3 requests"]],
            ["x402-host", "right", "weather-api.example", 3, ["3 calls", "0.006 USDC"]],
            ["refused-host", "right", "unregistered.example", 1, ["1 call"]],
            ["preview", "bottom", "Preview :3000", 59, ["59 requests"]],
            ["ssh", "bottom", "SSH", 1, ["1 session"]],
            ["transfers", "bottom", "Transfers", 2, ["2 files"]],
        ]);
        expect(model.empty).toBe(false);
        expect(model.eventsDropped).toBe(0);
        expect(new Set(model.nodes.map((n) => n.id)).size).toBe(model.nodes.length);
        expect(nodeOf(model, "payments").paidMicros).toBe(75_000);
        expect(nodeOf(model, "allowance").paidMicros).toBe(50_000);
    });

    it("splits each metric into parts, marking amounts, and only non-zero ones as money", () => {
        const model = buildMap(recordOf("ended-full"));
        const parts = (id: string) => nodeOf(model, id).metricParts;
        const count = (text: string) => ({ text, amount: false, money: false });
        const usdc = (text: string) => ({ text, amount: true, money: true });
        expect(parts("x402-host:search-api.example")).toEqual([
            count("5 calls"),
            usdc("0.024 USDC"),
        ]);
        expect(parts("payments")).toEqual([usdc("0.075 USDC paid")]);
        expect(parts("allowance")).toEqual([usdc("0.05 USDC"), count("paid in")]);
        expect(parts("sandbox")).toEqual([count("2 vCPU"), count("2 GiB"), count("15 min")]);
        expect(parts("mcp")).toEqual([count("19 tool calls")]);
        expect(parts("refused-host:unregistered.example")).toEqual([count("1 call")]);
    });

    it.each(["ended-full", "ended-crowded", "ended-hostile", "ended-empty"] as const)(
        "keeps %s's metrics and details as whole parts, none of them empty",
        (name) => {
            for (const node of buildMap(recordOf(name)).nodes) {
                for (const part of node.metricParts) expect(part.text, node.id).not.toBe("");
                for (const row of node.rows) expect(row.detail, node.id).not.toContain("");
            }
        },
    );

    it("gives the MCP node its job and file rows, and sorts every node's rows by time", () => {
        const model = buildMap(recordOf("ended-full"));
        const mcp = nodeOf(model, "mcp");
        const events = mcp.rows.map((r) => r.event);
        expect(events.filter((e) => e.startsWith("bugnet_"))).toHaveLength(19);
        expect(events.filter((e) => e.startsWith("Command #"))).toHaveLength(11);
        expect(events.filter((e) => e.startsWith("File "))).toEqual([
            "File write",
            "File read",
            "File list",
        ]);
        for (const node of model.nodes) {
            const times = node.rows.map((r) => r.at.getTime());
            expect(times, node.id).toEqual([...times].sort((a, b) => a - b));
        }
    });

    it("counts each x402 host's calls, refusals and payments as the fixture has them", () => {
        const model = buildMap(recordOf("ended-full"));
        expect(model.nodes.filter((n) => n.kind === "x402-host")).toHaveLength(2);
        const search = nodeOf(model, "x402-host:search-api.example");
        expect([search.count, search.refused, search.paidMicros, search.settling]).toEqual([
            5, 3, 24_000, 0,
        ]);
        expect(search.rows.map((r) => r.detail.join(", "))).toEqual([
            "paid",
            "paid",
            "refused: allowance spent",
            "refused: price above the approved maximum",
            "seller unreachable: seller unreachable",
        ]);
        const weather = nodeOf(model, "x402-host:weather-api.example");
        expect([weather.count, weather.refused, weather.paidMicros]).toEqual([3, 0, 6_000]);
        expect(weather.rows.map((r) => r.detail)).toEqual([["paid"], ["paid"], ["free"]]);
        const unregistered = nodeOf(model, "refused-host:unregistered.example");
        expect([unregistered.count, unregistered.refused, unregistered.paidMicros]).toEqual([
            1, 1, 0,
        ]);
        expect(texts(unregistered)).toEqual([["unregistered host", ["unregistered host"], "warn"]]);
    });

    it("folds ended-crowded's extra hosts and ports into one node each", () => {
        const model = buildMap(recordOf("ended-crowded"));
        const right = model.nodes.filter((n) => n.side === "right");
        expect(right).toHaveLength(MAX_RIGHT + 1);
        expect(right.map((n) => n.label)).toEqual([
            "api.github.com",
            "huggingface.co",
            "api.openai.com",
            "api.anthropic.com",
            "registry.npmjs.org",
            "api.stripe.com",
            "+15 more hosts",
        ]);
        const moreHosts = right.at(-1)!;
        expect(moreHosts.kind).toBe("more-right");
        expect(moreHosts.count).toBe(37 + 51);
        expect(moreHosts.refused).toBe(5);
        expect(moreHosts.paidMicros).toBeGreaterThan(0);
        // 37 secret host requests and 51 x402 calls, each call being one request
        expect(metric(moreHosts)[0]).toBe("88 requests");
        expect(metric(moreHosts)[1]).toMatch(/^\d+(\.\d+)? USDC$/);
        expect(moreHosts.metricParts.map((p) => p.money)).toEqual([false, true]);
        // The folded table still names each row's host
        expect(moreHosts.rows.some((r) => r.detail[0] === "sentry.io")).toBe(true);
        const geo = moreHosts.rows.filter((r) => r.detail[0] === "geo.x402.example");
        expect(geo.some((r) => r.detail.join(", ") === "geo.x402.example, paid")).toBe(true);

        const bottom = model.nodes.filter((n) => n.side === "bottom");
        expect(bottom.map((n) => n.label)).toEqual([
            "Preview :3000",
            "Preview :3001",
            "Preview :4173",
            "Preview :5173",
            "+3 more ports",
        ]);
        expect(bottom.filter((n) => n.kind === "preview")).toHaveLength(MAX_PREVIEWS);
        const morePorts = bottom.at(-1)!;
        expect(morePorts.kind).toBe("more-bottom");
        expect(morePorts.rows.some((r) => r.detail[0] === "port 9229")).toBe(true);
        expect(model.eventsDropped).toBe(120);
    });

    it("is empty when only the sandbox remains", () => {
        const model = buildMap(recordOf("ended-empty"));
        expect(model.empty).toBe(true);
        expect(model.nodes.map((n) => n.kind)).toEqual(["sandbox"]);
        expect(metric(model.nodes[0]!)).toEqual(["2 vCPU", "2 GiB", "10 min"]);
    });

    it("cuts a hostile host label to 24 characters and keeps the full one", () => {
        const model = buildMap(recordOf("ended-hostile"));
        const host = model.nodes.find((n) => n.kind === "x402-host")!;
        expect(host.fullLabel).toMatch(/^secure-bugnet-wallet-recovery-1\./);
        expect(Array.from(host.label)).toHaveLength(24);
        expect(host.label.endsWith("…")).toBe(true);
    });
});

/* One event of each kind */

const base = Date.UTC(2026, 10, 6, 10, 0, 0);
const t = (seconds: number) => new Date(base + seconds * 1000);
const tx = sampleTx("model-test");
const network = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

function record(events: SessionEvent[]): SessionRecord {
    return {
        startedAt: t(0),
        endedAt: t(1200),
        endedBecause: "deadline",
        deletesAt: t(1200 + 48 * 3600),
        output: "complete",
        events,
        eventsDropped: 0,
        jobs: [],
    };
}

type X402Fields = Partial<Extract<SessionEvent, { kind: "x402" }>>;

// A resolved-paid call when it carries money, else a call that moved none
function x402(status: string, amountMicros = 0, extra: X402Fields = {}): SessionEvent {
    return {
        at: t(500),
        kind: "x402",
        host: "pay.example",
        method: "POST",
        path: "/v1/search",
        status,
        reason: "",
        count: 1,
        askedMicros: amountMicros,
        amountMicros,
        asset: "USDC",
        network,
        resolved: amountMicros > 0 ? "paid" : null,
        ...(amountMicros > 0 ? { tx } : {}),
        resent: false,
        ...extra,
    };
}

describe("buildMap row text", () => {
    it("writes the sandbox's placement rows", () => {
        const deadline = t(900);
        const model = buildMap(
            record([
                {
                    at: t(0),
                    kind: "placement",
                    phase: "placed",
                    vcpu: 2,
                    memoryMib: 2048,
                    diskGib: 10,
                    minutes: 10,
                },
                { at: t(1), kind: "placement", phase: "ready" },
                { at: t(2), kind: "placement", phase: "extended", minutes: 5, deadline },
                { at: t(3), kind: "placement", phase: "ended", endedBecause: "deadline" },
                { at: t(4), kind: "placement", phase: "ended", endedBecause: "other" },
            ]),
        );
        const sandbox = nodeOf(model, "sandbox");
        expect(texts(sandbox)).toEqual([
            ["Placed", ["2 vCPU", "2 GiB", "10 GiB disk", "10 min"], "normal"],
            ["Ready", [], "normal"],
            ["Extended", ["+5 min", `until ${formatClock(deadline, t(1200))}`], "normal"],
            ["Ended", ["reached its deadline"], "normal"],
            ["Ended", [], "normal"],
        ]);
        expect(metric(sandbox)).toEqual(["2 vCPU", "2 GiB", "15 min"]);
        expect(model.empty).toBe(true);
    });

    it("shows memory in MiB when it is not whole GiB", () => {
        const model = buildMap(
            record([
                {
                    at: t(0),
                    kind: "placement",
                    phase: "placed",
                    vcpu: 1,
                    memoryMib: 1536,
                    minutes: 30,
                },
            ]),
        );
        expect(metric(nodeOf(model, "sandbox"))).toEqual(["1 vCPU", "1536 MiB", "30 min"]);
    });

    it("writes the payment rows with amounts and transactions", () => {
        const model = buildMap(
            record([
                { at: t(1), kind: "payment", payKind: "start", amountMicros: 50_000, tx },
                { at: t(2), kind: "payment", payKind: "extend", amountMicros: 25_000, tx },
                {
                    at: t(3),
                    kind: "allowance",
                    phase: "paid",
                    amountMicros: 40_000,
                    asset: "USDC",
                    network,
                    tx,
                },
                {
                    at: t(4),
                    kind: "allowance",
                    phase: "refunded",
                    amountMicros: 10_000,
                    asset: "USDC",
                    network,
                    tx: "not a signature",
                },
            ]),
        );
        const cells = (node: MapNode) =>
            node.rows.map((r) => [r.event, r.detail, r.amountMicros, r.amountTone, r.tx, r.tone]);
        const payments = nodeOf(model, "payments");
        expect(cells(payments)).toEqual([
            ["Start payment", [], 50_000, "money", tx, "normal"],
            ["Extension payment", [], 25_000, "money", tx, "normal"],
        ]);
        expect(payments.paidMicros).toBe(75_000);
        expect(metric(payments)).toEqual(["0.075 USDC paid"]);
        const allowance = nodeOf(model, "allowance");
        expect(cells(allowance)).toEqual([
            ["Allowance paid", [], 40_000, "money", tx, "normal"],
            ["Allowance refunded", [], 10_000, "money", "not a signature", "normal"],
        ]);
        expect(metric(allowance)).toEqual(["0.04 USDC", "paid in"]);
        expect(model.nodes.map((n) => n.id)).toEqual(["sandbox", "payments", "allowance"]);
    });

    it("writes the MCP, job and file rows", () => {
        const model = buildMap(
            record([
                { at: t(1), kind: "mcp", tool: "bugnet_exec", outcome: "ok", durationMs: 280 },
                {
                    at: t(2),
                    kind: "mcp",
                    tool: "bugnet_exec",
                    outcome: "timeout",
                    durationMs: 30_000,
                },
                { at: t(3), kind: "job", seq: 1, phase: "start" },
                { at: t(4), kind: "job", seq: 1, phase: "end", exitCode: 0, durationMs: 9_200 },
                { at: t(5), kind: "job", seq: 2, phase: "end", exitCode: 1, durationMs: 41_000 },
                {
                    at: t(6),
                    kind: "job",
                    seq: 3,
                    phase: "end",
                    exitCode: 137,
                    oom: true,
                    durationMs: 41_000,
                },
                { at: t(7), kind: "job", seq: 4, phase: "end", durationMs: 2_000 },
                { at: t(8), kind: "file", op: "write", path: "/workspace/a.json", bytes: 1_532 },
            ]),
        );
        const mcp = nodeOf(model, "mcp");
        expect(texts(mcp)).toEqual([
            ["bugnet_exec", ["ok", "0.2 s"], "normal"],
            ["bugnet_exec", ["timeout", "30 s"], "bad"],
            ["Command #1 started", [], "normal"],
            ["Command #1 ended", ["exit 0", "9.2 s"], "normal"],
            ["Command #2 ended", ["exit 1", "41 s"], "bad"],
            ["Command #3 ended", ["killed: out of memory", "41 s"], "bad"],
            ["Command #4 ended", ["2 s"], "normal"],
            ["File write", ["/workspace/a.json", "1.5 KiB"], "normal"],
        ]);
        expect(mcp.count).toBe(2);
        expect(mcp.rows.every((r) => r.amountMicros === null && r.tx === null)).toBe(true);
        expect(mcp.rows.every((r) => r.amountTone === null)).toBe(true);
    });

    it("writes the preview, transfer and SSH rows", () => {
        const model = buildMap(
            record([
                { at: t(1), kind: "preview", port: 3000, phase: "issued" },
                {
                    at: t(2),
                    kind: "preview",
                    port: 3000,
                    phase: "traffic",
                    requests: 42,
                    bytes: 172_032,
                },
                { at: t(3), kind: "preview", port: 3000, phase: "revoked" },
                { at: t(4), kind: "transfer", direction: "in", name: "data.csv", bytes: 2_400_000 },
                { at: t(5), kind: "transfer", direction: "out", name: "r.zip", bytes: 812_000 },
                { at: t(6), kind: "ssh", phase: "start" },
                { at: t(7), kind: "ssh", phase: "end", bytesIn: 18_432, bytesOut: 402_113 },
            ]),
        );
        expect(texts(nodeOf(model, "preview:3000"))).toEqual([
            ["Preview issued", ["port 3000"], "normal"],
            ["Requests", ["42 requests", "168 KiB"], "normal"],
            ["Preview revoked", ["port 3000"], "normal"],
        ]);
        expect(texts(nodeOf(model, "transfers"))).toEqual([
            ["Upload", ["data.csv", "2.3 MiB"], "normal"],
            ["Download", ["r.zip", "793 KiB"], "normal"],
        ]);
        expect(texts(nodeOf(model, "ssh"))).toEqual([
            ["SSH session started", [], "normal"],
            ["SSH session ended", ["18 KiB in", "393 KiB out"], "normal"],
        ]);
    });

    it("keeps a preview nobody opened, since it still has rows", () => {
        const model = buildMap(
            record([{ at: t(1), kind: "preview", port: 8080, phase: "issued" }]),
        );
        const preview = nodeOf(model, "preview:8080");
        expect([preview.count, metric(preview)]).toEqual([0, ["0 requests"]]);
        expect(model.empty).toBe(false);
    });

    it("writes the secret host rows", () => {
        const model = buildMap(
            record([
                { at: t(1), kind: "secret_host", host: "api.github.com", requests: 1, bytes: 900 },
            ]),
        );
        expect(texts(nodeOf(model, "secret-host:api.github.com"))).toEqual([
            ["Requests", ["1 request", "900 B"], "normal"],
        ]);
    });

    it("writes each x402 status, keeping an unknown one as a neutral raw word", () => {
        const model = buildMap(
            record([
                x402("paid", 3_000),
                x402("free"),
                x402("self_paid"),
                x402("refused_cap", 0, { reason: "rate_cap" }),
                x402("refused_price", 0, { reason: "price_above_max" }),
                x402("refused_payee", 0, { reason: "payto_blocked" }),
                x402("refused_network", 0, { reason: "network_unsupported" }),
                x402("refused_terms", 0, { reason: "flow_unsupported" }),
                x402("refused_request", 0, { reason: "body_slow" }),
                x402("not_paid", 0, { reason: "x402_disabled" }),
                x402("upstream_error", 0, { reason: "upstream_unreachable" }),
                x402("settled_late"),
                x402("toString", 0, { reason: "hasOwnProperty" }),
            ]),
        );
        const node = nodeOf(model, "x402-host:pay.example");
        expect(node.rows.map((r) => [r.detail.join(", "), r.tone])).toEqual([
            ["paid", "normal"],
            ["free", "normal"],
            ["self-paid", "normal"],
            ["refused: per-minute spending limit", "warn"],
            ["refused: price above the approved maximum", "warn"],
            ["refused: payee blocked", "warn"],
            ["refused: no USDC on Solana", "warn"],
            ["refused: unknown payment flow", "warn"],
            ["refused: body too slow", "warn"],
            ["not paid: payments switched off", "warn"],
            ["seller unreachable: seller unreachable", "warn"],
            ["settled_late", "normal"],
            ["toString: hasOwnProperty", "normal"],
        ]);
        expect(node.rows.every((r) => r.event === "POST /v1/search")).toBe(true);
        expect(node.rows.map((r) => [r.amountMicros, r.amountTone])).toEqual([
            [3_000, "money"],
            ...Array.from({ length: 12 }, () => [null, null]),
        ]);
        expect(node.rows[0]!.tx).toBe(tx);
        expect(node.rows[1]!.tx).toBeNull();
        // An unknown status is neither paid, settling nor refused
        expect([node.count, node.refused, node.paidMicros, node.settling]).toEqual([
            13, 8, 3_000, 0,
        ]);
    });

    it("leaves out a node with no events", () => {
        const model = buildMap(
            record([
                { at: t(1), kind: "mcp", tool: "bugnet_status", outcome: "ok", durationMs: 60 },
            ]),
        );
        expect(model.nodes.map((n) => n.kind)).toEqual(["sandbox", "mcp"]);
        expect(model.empty).toBe(false);
    });

    it("counts a fold of x402 hosts alone in calls, and one of secret hosts in requests", () => {
        const hosts = (kind: "x402" | "secret_host") =>
            Array.from({ length: MAX_RIGHT + 2 }, (_, i): SessionEvent => {
                const host = `h${i}.example`;
                if (kind === "secret_host") return { at: t(1), kind, host, requests: 2, bytes: 1 };
                const paid = {
                    status: "paid",
                    reason: "",
                    count: 1,
                    askedMicros: 1_000,
                    amountMicros: 1_000,
                    asset: "USDC",
                    network,
                    resolved: "paid" as const,
                    resent: false,
                };
                return { at: t(1), kind, host, method: "GET", path: "/", ...paid };
            });
        const fold = (events: SessionEvent[]) => nodeOf(buildMap(record(events)), "more-right");
        expect(metric(fold(hosts("x402")))).toEqual(["2 calls", "0.002 USDC"]);
        expect(metric(fold(hosts("secret_host")))).toEqual(["4 requests"]);
    });

    it("folds one extra port as +1 more port", () => {
        const events: SessionEvent[] = [3000, 3001, 3002, 3003, 3004].map((port) => ({
            at: t(1),
            kind: "preview",
            port,
            phase: "issued",
        }));
        const model = buildMap(record(events));
        expect(model.nodes.filter((n) => n.side === "bottom").map((n) => n.label)).toEqual([
            "Preview :3000",
            "Preview :3001",
            "Preview :3002",
            "Preview :3003",
            "+1 more port",
        ]);
    });
});

/* x402 money, settling, folds and the allowance's totals */

describe("buildMap on x402 calls and the allowance", () => {
    const x402Model = () => buildMap(recordOf("ended-x402"));
    const row = (node: MapNode, event: string, at = 0) =>
        node.rows.filter((r) => r.event === event)[at]!;

    it("counts a resent pair's money once, as one paid call", () => {
        const weather = nodeOf(x402Model(), "x402-host:weather-api.example");
        expect(weather.paidMicros).toBe(3_000);
        const forecast = weather.rows.filter((r) => r.event === "GET /v1/forecast");
        expect(forecast.map((r) => [r.detail, r.amountMicros, r.amountTone])).toEqual([
            [["paid"], 3_000, "money"],
            [["resent the same payment, not charged again"], null, null],
        ]);
        expect(forecast[0]!.tx).toBe(sampleTx("ended-x402:x402:forecast", 87));
        expect(forecast[1]!.tx).toBeNull();
        expect(weather.rows.filter((r) => r.amountTone === "money")).toHaveLength(1);
        expect(x402Model().allowance!.spent).toContainEqual({
            host: "weather-api.example",
            micros: 3_000,
        });
    });

    it("never counts a resent row as settling, even while its payment settles", () => {
        const model = buildMap(
            record([
                x402("paid", 2_000, { resolved: null, tx: undefined }),
                x402("paid", 0, { resolved: null, tx: undefined, resent: true }),
            ]),
        );
        const node = nodeOf(model, "x402-host:pay.example");
        expect([node.count, node.settling, node.paidMicros]).toEqual([2, 1, 0]);
        expect(node.rows.map((r) => [r.detail.join(", "), r.amountMicros, r.amountTone])).toEqual([
            ["settling, confirmed within a few minutes", 2_000, "muted"],
            ["resent the same payment, not charged again", null, null],
        ]);
    });

    it("counts a settling call apart, never as paid nor in the money colour", () => {
        const model = x402Model();
        const data = nodeOf(model, "x402-host:data-api.example");
        expect([data.paidMicros, data.settling, data.refused]).toEqual([0, 1, 3]);
        const query = row(data, "POST /v1/query");
        expect([query.detail, query.amountMicros, query.amountTone, query.tx, query.tone]).toEqual([
            ["settling, confirmed within a few minutes"],
            5_000,
            "muted",
            null,
            "normal",
        ]);
        expect(data.metricParts).toEqual([
            { text: "6 calls", amount: false, money: false },
            { text: "1 settling", amount: false, money: false },
        ]);
        const search = nodeOf(model, "x402-host:search-api.example");
        expect(metric(search)).toEqual(["45 calls", "0.012 USDC", "1 settling"]);
        expect(search.metricParts.map((p) => p.money)).toEqual([false, true, false]);
        // paid_no_answer is an uncertain call, so it settles and is never refused
        expect(row(search, "POST /v1/summarize").detail).toEqual([
            "settling, confirmed within a few minutes: seller did not answer",
        ]);
        expect(model.allowance!.settling).toEqual({ calls: 2, micros: 7_000 });
        expect(model.allowance!.spent.map((s) => s.host)).not.toContain("data-api.example");
    });

    it("reads a released payment as not charged, with no amount", () => {
        const data = nodeOf(x402Model(), "x402-host:data-api.example");
        const exported = row(data, "POST /v1/export");
        expect([exported.detail, exported.amountMicros, exported.amountTone, exported.tx]).toEqual([
            ["not charged: seller refused the payment"],
            null,
            null,
            null,
        ]);
        expect(exported.tone).toBe("normal");
    });

    it("counts a folded row of 40 refusals as 40 on the node and in its reason", () => {
        const model = x402Model();
        const search = nodeOf(model, "x402-host:search-api.example");
        expect([search.count, search.refused]).toEqual([45, 43]);
        expect(row(search, "40 calls").detail).toEqual(["refused: allowance spent"]);
        expect(row(search, "40 calls").tone).toBe("warn");
        expect(model.allowance!.refusedByReason[0]).toEqual({
            key: "allowance_spent",
            words: "allowance spent",
            calls: 41,
        });
    });

    it("counts a folded free row as its 12 calls, with no method or path", () => {
        const weather = nodeOf(x402Model(), "x402-host:weather-api.example");
        expect([weather.count, weather.refused]).toEqual([17, 2]);
        expect(metric(weather)).toEqual(["17 calls", "0.003 USDC"]);
        expect(row(weather, "12 calls").detail).toEqual(["free"]);
    });

    it("makes each unregistered name a refused node, the empty one reading other names", () => {
        const model = x402Model();
        const right = model.nodes.filter((n) => n.side === "right");
        expect(right.map((n) => [n.kind, n.fullLabel, n.count, n.refused])).toEqual([
            ["x402-host", "search-api.example", 45, 43],
            ["refused-host", "other names", 17, 17],
            ["x402-host", "weather-api.example", 17, 2],
            ["x402-host", "data-api.example", 6, 3],
            ["refused-host", "mirror.example", 3, 3],
            ["refused-host", "pay.unknown-seller.example", 1, 1],
            ["more-right", "+1 more host", 1, 1],
        ]);
        const other = nodeOf(model, "refused-host:");
        expect(other.fullLabel).toBe("other names");
        expect(texts(other)).toEqual([["17 calls", ["unregistered host"], "warn"]]);
        expect(metric(other)).toEqual(["17 calls"]);
        // Folded, each row names its host, as text
        const more = nodeOf(model, "more-right");
        expect(texts(more)).toEqual([
            ["unregistered host", ["zz-sample-ended-x402.example", "unregistered host"], "warn"],
        ]);
        expect(metric(more)).toEqual(["1 call"]);
    });

    it("names the empty unregistered row other names inside a fold", () => {
        const hosts = Array.from({ length: MAX_RIGHT + 1 }, (_, i) =>
            x402("refused_host", 0, {
                host: i === MAX_RIGHT ? "" : `h${i}.example`,
                method: "",
                path: "",
                count: MAX_RIGHT + 1 - i,
            }),
        );
        const more = nodeOf(buildMap(record(hosts)), "more-right");
        expect(texts(more)).toEqual([
            ["unregistered host", ["other names", "unregistered host"], "warn"],
        ]);
    });

    it("keeps allowance rows out of Payments and in their own node, under it", () => {
        const model = x402Model();
        const left = model.nodes.filter((n) => n.side === "left");
        expect(left.map((n) => n.kind)).toEqual(["mcp", "payments", "allowance"]);
        expect(nodeOf(model, "payments").rows.map((r) => r.event)).toEqual(["Start payment"]);
        expect(nodeOf(model, "allowance").rows.map((r) => r.event)).toEqual([
            "Allowance paid",
            "Allowance refunded",
        ]);
        expect(metric(nodeOf(model, "allowance"))).toEqual(["0.1 USDC", "paid in"]);
    });

    it("has no Allowance node or totals without an allowance row", () => {
        const model = buildMap(record([x402("paid", 3_000)]));
        expect(model.nodes.map((n) => n.kind)).not.toContain("allowance");
        expect(model.allowance).toBeNull();
    });

    it("totals ended-x402's allowance, refusals by reason, most first", () => {
        expect(x402Model().allowance).toEqual({
            paidInMicros: 100_000,
            spent: [
                { host: "search-api.example", micros: 12_000 },
                { host: "weather-api.example", micros: 3_000 },
            ],
            settling: { calls: 2, micros: 7_000 },
            refunded: { micros: 78_000, tx: sampleTx("ended-x402:refund") },
            keptMicros: null,
            refusedByReason: [
                { key: "allowance_spent", words: "allowance spent", calls: 41 },
                { key: "refused_host", words: "unregistered host", calls: 22 },
                { key: "body_too_large", words: "body over 1 MiB", calls: 1 },
                { key: "network_unsupported", words: "no USDC on Solana", calls: 1 },
                { key: "payee_changed", words: "payee changed", calls: 1 },
                { key: "payments_unavailable", words: "payment service down", calls: 1 },
                { key: "price_above_max", words: "price above the approved maximum", calls: 1 },
                { key: "splits_unsupported", words: "split payment", calls: 1 },
                { key: "upstream_unreachable", words: "seller unreachable", calls: 1 },
            ],
            // Off by the 0.007 still settling, which is no reason to doubt the figures
            reconciling: false,
        });
    });

    it("balances ended-x402-kept's totals, with the amount kept", () => {
        const model = buildMap(recordOf("ended-x402-kept"));
        expect(model.allowance).toEqual({
            paidInMicros: 50_000,
            spent: [
                { host: "search-api.example", micros: 36_000 },
                { host: "weather-api.example", micros: 10_000 },
            ],
            settling: { calls: 0, micros: 0 },
            refunded: null,
            keptMicros: 4_000,
            refusedByReason: [],
            reconciling: false,
        });
        const kept = row(nodeOf(model, "allowance"), "Kept under the minimum");
        expect([kept.amountMicros, kept.amountTone, kept.tx]).toEqual([4_000, "money", null]);
    });

    it("flags ended-x402-reconcile's figures, 0.01 USDC short", () => {
        const totals = buildMap(recordOf("ended-x402-reconcile")).allowance!;
        expect([totals.paidInMicros, totals.refunded?.micros, totals.reconciling]).toEqual([
            100_000,
            70_000,
            true,
        ]);
    });

    it("never flags the figures while anything settles, whatever the sums", () => {
        const settling = buildMap(recordOf("ended-x402-settling"));
        expect(settling.allowance!.settling).toEqual({ calls: 2, micros: 17_000 });
        expect(settling.allowance!.reconciling).toBe(false);
        const settled = buildMap(recordOf("ended-x402-settling", 1));
        expect(settled.allowance!.settling).toEqual({ calls: 0, micros: 0 });
        expect(settled.allowance!.reconciling).toBe(false);

        const allowance = (phase: "paid" | "refunded", amountMicros: number): SessionEvent => ({
            at: t(phase === "paid" ? 1 : 1300),
            kind: "allowance",
            phase,
            amountMicros,
            asset: "USDC",
            network,
            tx,
        });
        const unsettled = x402("paid", 5_000, { resolved: null, tx: undefined });
        const short = [allowance("paid", 50_000), x402("paid", 5_000), allowance("refunded", 1)];
        expect(buildMap(record(short)).allowance!.reconciling).toBe(true);
        expect(buildMap(record([...short, unsettled])).allowance!.reconciling).toBe(false);
    });

    it("waits for a refund or kept row before checking, unless all was spent", () => {
        const paidIn: SessionEvent = {
            at: t(1),
            kind: "allowance",
            phase: "paid",
            amountMicros: 10_000,
            asset: "USDC",
            network,
            tx,
        };
        const open = buildMap(record([paidIn, x402("paid", 4_000)])).allowance!;
        expect(open.reconciling).toBe(false);
        const spent = buildMap(record([paidIn, x402("paid", 4_000), x402("paid", 6_000)]));
        expect(spent.allowance!.reconciling).toBe(false);
    });

    it("leaves an unknown status out of the paid, settling and refused counts", () => {
        const paidIn: SessionEvent = {
            at: t(1),
            kind: "allowance",
            phase: "paid",
            amountMicros: 10_000,
            asset: "USDC",
            network,
            tx,
        };
        const totals = buildMap(record([paidIn, x402("settled_late", 0, { count: 3 })])).allowance!;
        expect([totals.spent, totals.settling, totals.refusedByReason]).toEqual([
            [],
            { calls: 0, micros: 0 },
            [],
        ]);
    });

    it("sums settling calls by their count, leaving out resent rows", () => {
        expect(settlingCalls(recordOf("ended-x402").events)).toBe(2);
        expect(settlingCalls(recordOf("ended-x402-settling").events)).toBe(2);
        expect(settlingCalls(recordOf("ended-x402-settling", 1).events)).toBe(0);
        expect(settlingCalls(recordOf("ended-x402-kept").events)).toBe(0);
        const events = [
            x402("uncertain", 1_000, { resolved: null, tx: undefined }),
            x402("payment_failed", 1_000, { resolved: null, tx: undefined }),
            x402("paid", 0, { resolved: null, tx: undefined, resent: true }),
            x402("paid", 1_000),
            x402("payment_failed", 1_000, { resolved: "released", tx: undefined }),
        ];
        expect(settlingCalls(events)).toBe(2);
    });

    const allScenarios = Object.keys(scenarios) as ScenarioName[];
    it.each(allScenarios.filter((name) => name.startsWith("ended")))(
        "writes no middle dot in %s's rows, metrics or totals",
        (name) => {
            const model = buildMap(recordOf(name));
            const words = model.nodes.flatMap((n) => [
                n.label,
                ...n.metricParts.map((p) => p.text),
                ...n.rows.flatMap((r) => [r.event, ...r.detail]),
            ]);
            words.push(...(model.allowance?.refusedByReason.map((r) => r.words) ?? []));
            for (const word of words) expect(word, name).not.toContain("\u00b7");
        },
    );
});
