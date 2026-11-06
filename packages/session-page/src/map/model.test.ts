import { describe, expect, it } from "vitest";
import { formatClock } from "../format.ts";
import { parseGetBody, type SessionEvent, type SessionRecord } from "../payload.ts";
import { makeScenarios, sampleTx, type ScenarioName } from "../testing/fixtures.ts";
import { buildMap, MAX_PREVIEWS, MAX_RIGHT, type MapModel, type MapNode } from "./model.ts";

const scenarios = makeScenarios(new Date("2026-11-06T12:00:00Z"));

function recordOf(name: ScenarioName): SessionRecord {
    const body = parseGetBody(scenarios[name].gets[0]!.body);
    if (body.state !== "ended") throw new Error(`expected ended, got ${body.state}`);
    return body.record;
}

function nodeOf(model: MapModel, id: string): MapNode {
    const node = model.nodes.find((n) => n.id === id);
    if (!node) throw new Error(`no node ${id}`);
    return node;
}

const texts = (node: MapNode) => node.rows.map((r) => [r.event, r.detail, r.tone]);

describe("buildMap on the sample sessions", () => {
    it("places ended-full's nodes in order, with their counts and metrics", () => {
        const model = buildMap(recordOf("ended-full"));
        expect(model.nodes.map((n) => [n.kind, n.side, n.label, n.count, n.metric])).toEqual([
            ["sandbox", "center", "Sandbox", 4, "2 vCPU · 2 GiB · 15 min"],
            ["mcp", "left", "Bugnet MCP", 19, "19 tool calls"],
            ["payments", "left", "Payments", 4, "0.125 USDC paid · 0.02 USDC refunded"],
            ["secret-host", "right", "api.github.com", 6, "6 requests"],
            ["x402-host", "right", "search-api.example", 5, "5 calls · 0.024 USDC"],
            ["secret-host", "right", "huggingface.co", 3, "3 requests"],
            ["x402-host", "right", "weather-api.example", 3, "3 calls · 0.006 USDC"],
            ["x402-host", "right", "unregistered.example", 1, "1 call"],
            ["preview", "bottom", "Preview :3000", 59, "59 requests"],
            ["ssh", "bottom", "SSH", 1, "1 session"],
            ["transfers", "bottom", "Transfers", 2, "2 files"],
        ]);
        expect(model.empty).toBe(false);
        expect(model.eventsDropped).toBe(0);
        expect(new Set(model.nodes.map((n) => n.id)).size).toBe(model.nodes.length);
        expect(nodeOf(model, "payments").paidMicros).toBe(125_000);
    });

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
        const record = recordOf("ended-full");
        const model = buildMap(record);
        const hosts = model.nodes.filter((n) => n.kind === "x402-host");
        expect(hosts).toHaveLength(3);
        for (const node of hosts) {
            const calls = record.events.filter(
                (e) => e.kind === "x402" && e.host === node.fullLabel,
            );
            const statuses = calls.map((e) => (e.kind === "x402" ? e.status : ""));
            const paid = calls.reduce((n, e) => n + (e.kind === "x402" ? e.amountMicros : 0), 0);
            expect(node.count, node.id).toBe(calls.length);
            expect(node.refused, node.id).toBe(
                statuses.filter((s) => s.startsWith("refused_")).length,
            );
            expect(node.paidMicros, node.id).toBe(paid);
            const details = node.rows.map((r) => r.detail);
            expect(details.filter((d) => d === "paid")).toHaveLength(
                statuses.filter((s) => s === "paid").length,
            );
            expect(details.filter((d) => d === "free")).toHaveLength(
                statuses.filter((s) => s === "free").length,
            );
        }
        const search = nodeOf(model, "x402-host:search-api.example");
        expect([search.count, search.refused, search.paidMicros]).toEqual([5, 2, 24_000]);
        const weather = nodeOf(model, "x402-host:weather-api.example");
        expect([weather.count, weather.refused, weather.paidMicros]).toEqual([3, 0, 6_000]);
        expect(weather.rows.map((r) => r.detail)).toEqual(["paid", "paid", "free"]);
        const unregistered = nodeOf(model, "x402-host:unregistered.example");
        expect([unregistered.count, unregistered.refused]).toEqual([1, 1]);
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
        expect(moreHosts.metric).toMatch(/^88 calls · \d+(\.\d+)? USDC$/);
        // The folded table still names each row's host
        expect(moreHosts.rows.some((r) => r.detail.startsWith("sentry.io · "))).toBe(true);
        expect(moreHosts.rows.some((r) => r.detail === "geo.x402.example · paid")).toBe(true);

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
        expect(morePorts.rows.some((r) => r.detail.startsWith("port 9229 · "))).toBe(true);
        expect(model.eventsDropped).toBe(120);
    });

    it("is empty when only the sandbox remains", () => {
        const model = buildMap(recordOf("ended-empty"));
        expect(model.empty).toBe(true);
        expect(model.nodes.map((n) => n.kind)).toEqual(["sandbox"]);
        expect(model.nodes[0]!.metric).toBe("2 vCPU · 2 GiB · 10 min");
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

function x402(status: string, amountMicros = 0): SessionEvent {
    return {
        at: t(500),
        kind: "x402",
        host: "pay.example",
        method: "POST",
        path: "/v1/search",
        status,
        amountMicros,
        asset: "USDC",
        network,
        ...(amountMicros > 0 ? { tx } : {}),
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
            ["Placed", "2 vCPU · 2 GiB · 10 GiB disk · 10 min", "normal"],
            ["Ready", "", "normal"],
            ["Extended", `+5 min, until ${formatClock(deadline, t(1200))}`, "normal"],
            ["Ended", "reached its deadline", "normal"],
            ["Ended", "", "normal"],
        ]);
        expect(sandbox.metric).toBe("2 vCPU · 2 GiB · 15 min");
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
        expect(nodeOf(model, "sandbox").metric).toBe("1 vCPU · 1536 MiB · 30 min");
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
        const payments = nodeOf(model, "payments");
        expect(payments.rows.map((r) => [r.event, r.detail, r.amountMicros, r.tx, r.tone])).toEqual(
            [
                ["Start payment", "", 50_000, tx, "normal"],
                ["Extension payment", "", 25_000, tx, "normal"],
                ["Allowance paid", "", 40_000, tx, "normal"],
                ["Allowance refunded", "", 10_000, "not a signature", "normal"],
            ],
        );
        expect(payments.paidMicros).toBe(115_000);
        expect(payments.metric).toBe("0.115 USDC paid · 0.01 USDC refunded");
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
            ["bugnet_exec", "ok · 0.2 s", "normal"],
            ["bugnet_exec", "timeout · 30 s", "bad"],
            ["Command #1 started", "", "normal"],
            ["Command #1 ended", "exit 0 · 9.2 s", "normal"],
            ["Command #2 ended", "exit 1 · 41 s", "bad"],
            ["Command #3 ended", "killed: out of memory · 41 s", "bad"],
            ["Command #4 ended", "2 s", "normal"],
            ["File write", "/workspace/a.json · 1.5 KiB", "normal"],
        ]);
        expect(mcp.count).toBe(2);
        expect(mcp.rows.every((r) => r.amountMicros === null && r.tx === null)).toBe(true);
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
            ["Preview issued", "port 3000", "normal"],
            ["Requests", "42 requests · 168 KiB", "normal"],
            ["Preview revoked", "port 3000", "normal"],
        ]);
        expect(texts(nodeOf(model, "transfers"))).toEqual([
            ["Upload", "data.csv · 2.3 MiB", "normal"],
            ["Download", "r.zip · 793 KiB", "normal"],
        ]);
        expect(texts(nodeOf(model, "ssh"))).toEqual([
            ["SSH session started", "", "normal"],
            ["SSH session ended", "18 KiB in · 393 KiB out", "normal"],
        ]);
    });

    it("keeps a preview nobody opened, since it still has rows", () => {
        const model = buildMap(
            record([{ at: t(1), kind: "preview", port: 8080, phase: "issued" }]),
        );
        const preview = nodeOf(model, "preview:8080");
        expect([preview.count, preview.metric]).toEqual([0, "0 requests"]);
        expect(model.empty).toBe(false);
    });

    it("writes the secret host rows", () => {
        const model = buildMap(
            record([
                { at: t(1), kind: "secret_host", host: "api.github.com", requests: 1, bytes: 900 },
            ]),
        );
        expect(texts(nodeOf(model, "secret-host:api.github.com"))).toEqual([
            ["Requests", "1 request · 900 B", "normal"],
        ]);
    });

    it("writes each x402 status, keeping an unknown one as its raw word", () => {
        const model = buildMap(
            record([
                x402("paid", 3_000),
                x402("free"),
                x402("refused_cap"),
                x402("refused_price"),
                x402("refused_host"),
                x402("upstream_error"),
                x402("settled_late", 1_000),
                x402("toString"),
            ]),
        );
        const node = nodeOf(model, "x402-host:pay.example");
        expect(texts(node)).toEqual([
            ["POST /v1/search", "paid", "normal"],
            ["POST /v1/search", "free", "normal"],
            ["POST /v1/search", "refused: allowance used up", "warn"],
            ["POST /v1/search", "refused: price above the cap", "warn"],
            ["POST /v1/search", "refused: host not registered", "warn"],
            ["POST /v1/search", "upstream error", "bad"],
            ["POST /v1/search", "settled_late", "normal"],
            ["POST /v1/search", "toString", "normal"],
        ]);
        expect(node.rows.map((r) => r.amountMicros)).toEqual([
            3_000,
            null,
            null,
            null,
            null,
            null,
            1_000,
            null,
        ]);
        expect(node.rows[0]!.tx).toBe(tx);
        expect(node.rows[1]!.tx).toBeNull();
        expect([node.count, node.refused, node.paidMicros]).toEqual([8, 3, 4_000]);
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
