import { describe, expect, it } from "vitest";
import { parseGetBody, type SessionEvent, type SessionRecord } from "../payload.ts";
import { makeScenarios, type ScenarioName } from "../testing/fixtures.ts";
import { formatUsdc } from "../format.ts";
import { layoutMap, radiusFor, type EdgePart, type MapLayout, type Placed } from "./layout.ts";
import { buildMap, SEPARATOR, type MapModel } from "./model.ts";

const scenarios = makeScenarios(new Date("2026-11-06T12:00:00Z"));

function recordOf(name: ScenarioName): SessionRecord {
    const body = parseGetBody(scenarios[name].gets[0]!.body);
    if (body.state !== "ended") throw new Error(`expected ended, got ${body.state}`);
    return body.record;
}

const at = new Date("2026-11-06T10:00:00Z");

function mapOf(events: SessionEvent[]): MapModel {
    return buildMap({
        startedAt: at,
        endedAt: at,
        endedBecause: "stopped",
        deletesAt: at,
        output: "complete",
        events,
        eventsDropped: 0,
        jobs: [],
    });
}

// Every place at once, with the longest labels and a part-refused host in the middle row
function busiest(): MapModel {
    const long = (i: number) => `${String.fromCharCode(97 + i)}-very-long-registered-host.example`;
    return mapOf([
        { at, kind: "placement", phase: "placed", vcpu: 16, memoryMib: 65_536, minutes: 1_440 },
        ...Array.from({ length: 400 }, (): SessionEvent => ({
            at,
            kind: "mcp",
            tool: "bugnet_exec",
            outcome: "ok",
            durationMs: 1,
        })),
        { at, kind: "payment", payKind: "start", amountMicros: 12_345_678, tx: "x" },
        {
            at,
            kind: "allowance",
            phase: "refunded",
            amountMicros: 1_234_567,
            asset: "USDC",
            network: "n",
            tx: "x",
        },
        ...[900, 800, 700].map((requests, i): SessionEvent => ({
            at,
            kind: "secret_host",
            host: long(i),
            requests,
            bytes: 1,
        })),
        ...Array.from({ length: 600 }, (_, i): SessionEvent => ({
            at,
            kind: "x402",
            host: long(3),
            method: "GET",
            path: "/",
            status: i % 2 ? "paid" : "refused_cap",
            amountMicros: i % 2 ? 123_456 : 0,
            asset: "USDC",
            network: "n",
        })),
        ...[500, 400, 300, 200].map((requests, i): SessionEvent => ({
            at,
            kind: "secret_host",
            host: long(4 + i),
            requests,
            bytes: 1,
        })),
        ...[10_001, 10_002, 10_003, 10_004, 10_005, 10_006].map((port): SessionEvent => ({
            at,
            kind: "preview",
            port,
            phase: "traffic",
            requests: 12_345,
            bytes: 1,
        })),
        { at, kind: "ssh", phase: "start" },
        { at, kind: "transfer", direction: "in", name: "a", bytes: 1 },
    ]);
}

const models: [string, () => MapModel][] = [
    ["ended-full", () => buildMap(recordOf("ended-full"))],
    ["ended-crowded", () => buildMap(recordOf("ended-crowded"))],
    ["ended-hostile", () => buildMap(recordOf("ended-hostile"))],
    ["ended-empty", () => buildMap(recordOf("ended-empty"))],
    ["busiest", busiest],
];
const widths = [720, 900, 1152];

/* Boxes, estimated apart from the layout's own sums */

const CHAR = 7.5;
const LINE = 16;

interface Box {
    what: string;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

const chars = (s: string) => Array.from(s).length;

function lineBoxes(p: Placed): Box[] {
    const lines = [p.node.label, ...p.metricLines];
    return lines.map((line, i) => {
        const w = chars(line) * CHAR;
        const x0 =
            p.labelAnchor === "end"
                ? p.labelX - w
                : p.labelAnchor === "start"
                  ? p.labelX
                  : p.labelX - w / 2;
        const y0 = p.labelY - 12 + i * LINE;
        return { what: `${p.node.id} line ${i}`, x0, y0, x1: x0 + w, y1: y0 + LINE };
    });
}

function labelBox(p: Placed): Box {
    const lines = lineBoxes(p);
    return {
        what: `${p.node.id} label`,
        x0: Math.min(...lines.map((b) => b.x0)),
        y0: lines[0]!.y0,
        x1: Math.max(...lines.map((b) => b.x1)),
        y1: lines.at(-1)!.y1,
    };
}

function edgeBoxes(layout: MapLayout): Box[] {
    return layout.edges
        .filter((e) => e.lines.length > 0)
        .map((e) => ({
            what: `edge to ${e.to.node.id}`,
            x0: e.box.x,
            y0: e.box.y,
            x1: e.box.x + e.box.width,
            y1: e.box.y + e.box.height,
        }));
}

const lineText = (line: EdgePart[]) => line.map((part) => part.text).join(SEPARATOR);
const drawn = (lines: EdgePart[][]) => lines.map(lineText);

function circleHitsBox(p: Placed, b: Box): boolean {
    const nx = Math.min(Math.max(p.x, b.x0), b.x1);
    const ny = Math.min(Math.max(p.y, b.y0), b.y1);
    return Math.hypot(p.x - nx, p.y - ny) < p.r;
}

const boxesMeet = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

function inside(b: Box, layout: MapLayout): boolean {
    return b.x0 >= 0 && b.y0 >= 0 && b.x1 <= layout.width && b.y1 <= layout.height;
}

describe("radiusFor", () => {
    it("grows with the count between 16 and 40", () => {
        expect(radiusFor(0)).toBe(16);
        expect(radiusFor(4)).toBe(26);
        expect(radiusFor(1_000)).toBe(40);
    });
});

describe.each(models)("layoutMap(%s)", (name, model) => {
    describe.each(widths)("at %i px", (width) => {
        const layout = layoutMap(model(), width);
        const circles = [layout.center, ...layout.placed];
        const labels = layout.placed.map(labelBox);
        const edges = edgeBoxes(layout);

        it("places every node once and fills the width", () => {
            expect(layout.width).toBe(width);
            expect(circles.map((p) => p.node.id)).toEqual(model().nodes.map((n) => n.id));
            expect(layout.edges.map((e) => e.to)).toEqual(layout.placed);
        });

        it("keeps every circle and label inside the map", () => {
            for (const p of circles) {
                const box = {
                    what: p.node.id,
                    x0: p.x - p.r,
                    y0: p.y - p.r,
                    x1: p.x + p.r,
                    y1: p.y + p.r,
                };
                expect(inside(box, layout), p.node.id).toBe(true);
            }
            for (const b of [...labels, ...edges]) expect(inside(b, layout), b.what).toBe(true);
        });

        it("keeps circles 8 px apart", () => {
            for (const [i, a] of circles.entries()) {
                for (const b of circles.slice(i + 1)) {
                    const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
                    expect(gap, `${a.node.id} and ${b.node.id}`).toBeGreaterThanOrEqual(8);
                }
            }
        });

        it("lets no label touch a circle or another label", () => {
            const boxes = [...labels, ...edges];
            for (const b of boxes) {
                for (const p of circles)
                    expect(circleHitsBox(p, b), `${b.what} on ${p.node.id}`).toBe(false);
            }
            for (const [i, a] of boxes.entries()) {
                for (const b of boxes.slice(i + 1)) {
                    expect(boxesMeet(a, b), `${a.what} and ${b.what}`).toBe(false);
                }
            }
        });

        it("gives each label two lines, its name and a metric of 24 characters at most", () => {
            for (const p of layout.placed) {
                expect(lineBoxes(p), p.node.id).toHaveLength(2);
                expect(chars(p.metricLines[0]!), p.node.id).toBeLessThanOrEqual(24);
            }
        });

        it("fits the sandbox's own lines inside its circle", () => {
            const c = layout.center;
            for (const b of lineBoxes(c)) {
                for (const [x, y] of [
                    [b.x0, b.y0],
                    [b.x1, b.y0],
                    [b.x0, b.y1],
                    [b.x1, b.y1],
                ] as const) {
                    expect(Math.hypot(x - c.x, y - c.y), b.what).toBeLessThanOrEqual(c.r);
                }
            }
        });

        it("draws each edge between the two circles, its label box over its midpoint", () => {
            for (const e of layout.edges) {
                const c = layout.center;
                expect(Math.hypot(e.x1 - c.x, e.y1 - c.y)).toBeCloseTo(c.r, 6);
                expect(Math.hypot(e.x2 - e.to.x, e.y2 - e.to.y)).toBeCloseTo(e.to.r, 6);
                expect(e.box.x + e.box.width / 2).toBeCloseTo((e.x1 + e.x2) / 2, 6);
                expect(e.box.y + e.box.height / 2).toBeCloseTo((e.y1 + e.y2) / 2, 6);
                const widest = Math.max(...e.lines.map((line) => chars(lineText(line))));
                expect(e.box.width).toBeGreaterThanOrEqual(widest * CHAR);
                expect(e.box.height).toBeGreaterThanOrEqual(e.lines.length * LINE);
            }
        });

        it("colours only amounts as money, and counts muted or warn", () => {
            for (const e of layout.edges) {
                for (const part of e.lines.flat()) {
                    const amount = part.text.endsWith(" USDC");
                    expect(part.tone === "money", `${e.to.node.id} ${part.text}`).toBe(
                        amount && e.to.node.paidMicros > 0,
                    );
                }
            }
        });

        it("draws every refusal, and the total paid or nothing on the Payments edge", () => {
            for (const e of layout.edges) {
                const text = drawn(e.lines).join(SEPARATOR);
                const { node } = e.to;
                if (e.refusedLabel) expect(text, node.id).toContain(e.refusedLabel);
                if (node.kind !== "payments") continue;
                const sample = name !== "busiest";
                expect([formatUsdc(node.paidMicros), ...(sample ? [] : [""])]).toContain(text);
            }
        });

        it("is 460 tall unless the bottom row needs more room", () => {
            const lowest = Math.max(0, ...labels.map((b) => b.y1));
            expect(layout.height).toBe(Math.max(460, lowest));
        });

        it("gives the same layout for the same input", () => {
            expect(layoutMap(model(), width)).toEqual(layout);
        });
    });
});

describe("layoutMap edges", () => {
    const layout = layoutMap(buildMap(recordOf("ended-full")), 900);
    const edge = (id: string) => layout.edges.find((e) => e.to.node.id === id)!;

    it("labels each edge as the spec's table says, marking money and refusals", () => {
        expect(edge("payments")).toMatchObject({
            label: "0.125 USDC",
            money: true,
            dashed: false,
            refusedLabel: null,
            lines: [[{ text: "0.125 USDC", tone: "money" }]],
        });
        expect(edge("x402-host:weather-api.example")).toMatchObject({
            label: "3 · 0.006 USDC",
            money: true,
            dashed: false,
            refusedLabel: null,
        });
        expect(edge("x402-host:search-api.example")).toMatchObject({
            label: "5 · 0.024 USDC",
            money: true,
            dashed: false,
            refusedLabel: "2 refused",
        });
        expect(edge("x402-host:unregistered.example")).toMatchObject({
            label: "1",
            money: false,
            dashed: true,
            refusedLabel: null,
            lines: [[{ text: "1", tone: "warn" }]],
        });
        expect(edge("mcp")).toMatchObject({
            label: "19",
            money: false,
            dashed: false,
            lines: [[{ text: "19", tone: "muted" }]],
        });
        expect(edge("secret-host:api.github.com").lines).toEqual([[{ text: "6", tone: "muted" }]]);
    });

    it("draws calls, total paid and refusals together where they fit", () => {
        const wide = layoutMap(buildMap(recordOf("ended-full")), 1152);
        const at = (id: string) => drawn(wide.edges.find((e) => e.to.node.id === id)!.lines);
        expect(at("x402-host:search-api.example")).toEqual(["5 · 0.024 USDC · 2 refused"]);
        expect(at("x402-host:weather-api.example")).toEqual(["3 · 0.006 USDC"]);
        const search = edge("x402-host:search-api.example").lines;
        expect(search.flat().map((p) => [p.text, p.tone])).toEqual([
            ["5", "muted"],
            ["0.024 USDC", "money"],
            ["2 refused", "warn"],
        ]);
    });

    it("leaves the Payments edge bare when its total has no room, rather than show a count", () => {
        const tight = layoutMap(busiest(), 720);
        const payments = tight.edges.find((e) => e.to.node.kind === "payments")!;
        expect(payments.label).toBe("12.345678 USDC");
        expect(payments.lines).toEqual([]);
        const roomy = layoutMap(busiest(), 900).edges.find((e) => e.to.node.kind === "payments")!;
        expect(drawn(roomy.lines)).toEqual(["12.345678 USDC"]);
    });

    it("keeps the total paid on a narrow map, dropping the call count first", () => {
        const narrow = layoutMap(buildMap(recordOf("ended-full")), 720);
        for (const e of narrow.edges.filter((x) => x.to.node.paidMicros > 0)) {
            const text = drawn(e.lines).join(SEPARATOR);
            expect(text, e.to.node.id).toContain(formatUsdc(e.to.node.paidMicros));
        }
    });

    it("anchors left labels at the end and right labels at the start", () => {
        for (const p of layout.placed) {
            const want = { left: "end", right: "start", bottom: "middle", center: "middle" };
            expect(p.labelAnchor, p.node.id).toBe(want[p.node.side]);
        }
        const left = layout.placed.filter((p) => p.node.side === "left");
        const right = layout.placed.filter((p) => p.node.side === "right");
        expect(left.every((p) => p.x < layout.center.x && p.labelX === p.x - p.r - 12)).toBe(true);
        expect(right.every((p) => p.x > layout.center.x && p.labelX === p.x + p.r + 12)).toBe(true);
    });

    it("puts an empty map's sandbox where a full map has it", () => {
        const empty = layoutMap(buildMap(recordOf("ended-empty")), 900);
        expect(empty).toMatchObject({ height: 460, placed: [], edges: [] });
        expect([empty.center.x, empty.center.y]).toEqual([450, 190]);
    });

    it("draws a Payments metric over 24 characters as its total paid", () => {
        const payments = layout.placed.find((p) => p.node.id === "payments")!;
        expect(payments.node.metric).toBe("0.125 USDC paid · 0.02 USDC refunded");
        expect(payments.metricLines).toEqual(["0.125 USDC paid"]);
        const busy = layoutMap(busiest(), 720).placed.find((p) => p.node.kind === "payments")!;
        expect(busy.metricLines).toEqual(["12.345678 USDC paid"]);
    });

    it("draws a host metric over 24 characters as its amount, and a short one whole", () => {
        const call = (i: number): SessionEvent => ({
            at,
            kind: "x402",
            host: i < 100 ? "big.example" : "small.example",
            method: "GET",
            path: "/",
            status: i % 100 === 0 ? "paid" : "free",
            amountMicros: i % 100 === 0 ? 12_345_678 : 0,
            asset: "USDC",
            network: "n",
        });
        const model = mapOf([
            { at, kind: "placement", phase: "placed", vcpu: 2, memoryMib: 2_048, minutes: 10 },
            ...Array.from({ length: 103 }, (_, i) => call(i)),
        ]);
        const placed = layoutMap(model, 720).placed;
        const host = (id: string) => placed.find((p) => p.node.id === `x402-host:${id}`)!;
        expect(host("big.example").node.metric).toBe("100 calls · 12.345678 USDC");
        expect(host("big.example").metricLines).toEqual(["12.345678 USDC"]);
        expect(host("small.example").metricLines).toEqual(["3 calls · 12.345678 USDC"]);
    });
});
