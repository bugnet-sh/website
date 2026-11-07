import { describe, expect, it } from "vitest";
import { parseGetBody, type SessionEvent, type SessionRecord } from "../payload.ts";
import { makeScenarios, type ScenarioName } from "../testing/fixtures.ts";
import { GAP, layoutMap, type MapLayout, type Placed } from "./layout.ts";
import { buildMap, type MapModel } from "./model.ts";

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
function busiest(paidMicros = 12_345_678): MapModel {
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
        { at, kind: "payment", payKind: "start", amountMicros: paidMicros, tx: "x" },
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
            reason: "",
            count: 1,
            askedMicros: 123_456,
            amountMicros: i % 2 ? 123_456 : 0,
            asset: "USDC",
            network: "n",
            resolved: i % 2 ? "paid" : null,
            resent: false,
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
const widths = [720, 900, 1152, 1200] as const;

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
const lineWidth = (line: { text: string }[]) =>
    line.reduce((w, part, i) => w + chars(part.text) * CHAR + (i > 0 ? GAP : 0), 0);

function lineBoxes(p: Placed): Box[] {
    const lines = [[{ text: p.node.label }], ...p.metricLines];
    return lines.map((line, i) => {
        const w = lineWidth(line);
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

const drawn = (lines: { text: string }[][]) => lines.map((line) => line.map((p) => p.text));

function circleHitsBox(p: Placed, b: Box): boolean {
    const nx = Math.min(Math.max(p.x, b.x0), b.x1);
    const ny = Math.min(Math.max(p.y, b.y0), b.y1);
    return Math.hypot(p.x - nx, p.y - ny) < p.r;
}

const boxesMeet = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

function inside(b: Box, layout: MapLayout): boolean {
    const bottom = layout.top + layout.height;
    return b.x0 >= 0 && b.y0 >= layout.top && b.x1 <= layout.width && b.y1 <= bottom;
}

const circleBox = (p: Placed): Box => ({
    what: p.node.id,
    x0: p.x - p.r,
    y0: p.y - p.r,
    x1: p.x + p.r,
    y1: p.y + p.r,
});

// Everything the map draws: circles, labels beside them, edge labels and the empty map's note
function inkBoxes(layout: MapLayout): Box[] {
    const note: Box[] =
        layout.note === null
            ? []
            : [
                  {
                      what: "note",
                      x0: layout.note.x,
                      y0: layout.note.y - 12,
                      x1: layout.note.x,
                      y1: layout.note.y - 12 + LINE,
                  },
              ];
    return [
        ...[layout.center, ...layout.placed].map(circleBox),
        ...layout.placed.map(labelBox),
        ...edgeBoxes(layout),
        ...note,
    ];
}

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
            for (const p of circles) expect(inside(circleBox(p), layout), p.node.id).toBe(true);
            for (const b of [...labels, ...edges]) expect(inside(b, layout), b.what).toBe(true);
        });

        it("crops the map to what it draws, with no empty band above or below", () => {
            const ink = inkBoxes(layout);
            expect(layout.top).toBeCloseTo(Math.min(...ink.map((b) => b.y0)), 6);
            const bottom = Math.max(...ink.map((b) => b.y1));
            expect(layout.top + layout.height).toBeCloseTo(bottom, 6);
        });

        it("sizes every bubble on one square-root scale, a larger count never smaller", () => {
            const others = layout.placed;
            if (others.length === 0) return;
            const cap = Math.max(...others.map((p) => p.r));
            const most = Math.max(1, ...others.map((p) => p.node.count));
            for (const p of others) {
                const r = Math.max(Math.min(12, cap), cap * Math.sqrt(p.node.count / most));
                expect(p.r, p.node.id).toBeCloseTo(r, 6);
                // A one-event bubble still reads as a bubble, and the busiest one never swamps
                expect(p.r, p.node.id).toBeGreaterThanOrEqual(12);
                expect(p.r, p.node.id).toBeLessThanOrEqual(36);
            }
            for (const a of others) {
                for (const b of others) {
                    if (a.node.count >= b.node.count) {
                        expect(a.r, `${a.node.id} and ${b.node.id}`).toBeGreaterThanOrEqual(b.r);
                    }
                }
            }
        });

        it("starts every label of a column at one shared edge", () => {
            for (const side of ["left", "right"] as const) {
                const column = layout.placed.filter((p) => p.node.side === side);
                if (column.length === 0) continue;
                const rMax = Math.max(...column.map((p) => p.r));
                for (const p of column) {
                    const edge = side === "left" ? p.x - rMax - 12 : p.x + rMax + 12;
                    expect(p.labelX, p.node.id).toBe(edge);
                }
            }
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

        it("gives each label two lines, its name and a metric no wider than 24 characters", () => {
            for (const p of layout.placed) {
                expect(lineBoxes(p), p.node.id).toHaveLength(2);
                expect(lineWidth(p.metricLines[0]!), p.node.id).toBeLessThanOrEqual(24 * CHAR);
            }
        });

        it("marks only the amounts of a node's metric as money", () => {
            for (const p of [layout.center, ...layout.placed]) {
                for (const part of p.metricLines.flat()) {
                    const amount = / USDC( paid| refunded)?$/.test(part.text);
                    expect(part.money, `${p.node.id} ${part.text}`).toBe(amount);
                }
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
                const widest = Math.max(...e.lines.map(lineWidth));
                expect(e.box.width).toBeGreaterThanOrEqual(widest);
                expect(e.box.height).toBeGreaterThanOrEqual(e.lines.length * LINE);
            }
        });

        it("labels an edge only with its refusals, in the warning colour", () => {
            for (const e of layout.edges) {
                const { node } = e.to;
                const want = node.refused > 0 ? [[`${node.refused} refused`]] : [];
                expect(drawn(e.lines), node.id).toEqual(want);
                expect(e.refusedLabel, node.id).toBe(node.refused > 0 ? want[0]![0] : null);
                for (const part of e.lines.flat()) expect(part.tone, node.id).toBe("warn");
            }
        });

        it("gives the same layout for the same input", () => {
            expect(layoutMap(model(), width)).toEqual(layout);
        });
    });
});

describe("layoutMap edges", () => {
    const layout = layoutMap(buildMap(recordOf("ended-full")), 900);
    const edge = (id: string) => layout.edges.find((e) => e.to.node.id === id)!;

    it("keeps counts and amounts under the bubbles, and refusals on the edges", () => {
        expect(edge("payments")).toMatchObject({
            money: true,
            dashed: false,
            refusedLabel: null,
            lines: [],
        });
        expect(edge("x402-host:weather-api.example")).toMatchObject({
            money: true,
            dashed: false,
            refusedLabel: null,
            lines: [],
        });
        expect(edge("x402-host:search-api.example")).toMatchObject({
            money: true,
            dashed: false,
            refusedLabel: "2 refused",
            lines: [[{ text: "2 refused", tone: "warn" }]],
        });
        expect(edge("x402-host:unregistered.example")).toMatchObject({
            money: false,
            dashed: true,
            refusedLabel: "1 refused",
            lines: [[{ text: "1 refused", tone: "warn" }]],
        });
        expect(edge("mcp")).toMatchObject({ money: false, dashed: false, lines: [] });
        expect(edge("secret-host:api.github.com").lines).toEqual([]);
    });

    it("draws every refusal at every width, with no shorter form to fall back on", () => {
        for (const width of widths) {
            for (const model of [busiest(), buildMap(recordOf("ended-crowded"))]) {
                for (const e of layoutMap(model, width).edges) {
                    if (e.to.node.refused === 0) continue;
                    expect(drawn(e.lines), `${e.to.node.id} at ${width}`).toEqual([
                        [`${e.to.node.refused} refused`],
                    ]);
                }
            }
        }
    });

    it("crops the maps to the heights it draws them at", () => {
        const heights = (name: ScenarioName) =>
            widths.map((w) => Math.round(layoutMap(buildMap(recordOf(name)), w).height * 10) / 10);
        expect(heights("ended-full")).toEqual([390, 390, 390, 390]);
        expect(heights("ended-crowded")).toEqual([443.9, 387.9, 387.9, 387.9]);
    });

    it("anchors left labels at the end and right labels at the start", () => {
        for (const p of layout.placed) {
            const want = { left: "end", right: "start", bottom: "middle", center: "middle" };
            expect(p.labelAnchor, p.node.id).toBe(want[p.node.side]);
        }
        const left = layout.placed.filter((p) => p.node.side === "left");
        const right = layout.placed.filter((p) => p.node.side === "right");
        expect(left.every((p) => p.x < layout.center.x && p.labelX < p.x - p.r)).toBe(true);
        expect(right.every((p) => p.x > layout.center.x && p.labelX > p.x + p.r)).toBe(true);
    });

    it("puts an empty map's sandbox where a full map has it, its note under it", () => {
        const empty = layoutMap(buildMap(recordOf("ended-empty")), 900);
        expect(empty).toMatchObject({ placed: [], edges: [] });
        expect([empty.center.x, empty.center.y]).toEqual([450, 190]);
        expect(empty.note).toEqual({ x: 450, y: 190 + 56 + 28 });
        expect([empty.top, empty.height]).toEqual([190 - 56, 56 + 28 + 4 + 56]);
        expect(layoutMap(buildMap(recordOf("ended-full")), 900).note).toBeNull();
    });

    it("draws a Payments metric over 24 characters as its total paid", () => {
        const payments = layout.placed.find((p) => p.node.id === "payments")!;
        expect(payments.node.metricParts.map((p) => p.text)).toEqual([
            "0.125 USDC paid",
            "0.02 USDC refunded",
        ]);
        expect(drawn(payments.metricLines)).toEqual([["0.125 USDC paid"]]);
        const busy = layoutMap(busiest(), 720).placed.find((p) => p.node.kind === "payments")!;
        expect(drawn(busy.metricLines)).toEqual([["12.345678 USDC paid"]]);
    });

    it("draws Payments with nothing paid and a refund as 0 USDC paid, not the refund", () => {
        const model = mapOf([
            { at, kind: "placement", phase: "placed", vcpu: 2, memoryMib: 2_048, minutes: 10 },
            {
                at,
                kind: "allowance",
                phase: "refunded",
                amountMicros: 20_000,
                asset: "USDC",
                network: "n",
                tx: "x",
            },
        ]);
        const payments = layoutMap(model, 720).placed.find((p) => p.node.kind === "payments")!;
        expect(payments.node.metricParts.map((p) => p.text)).toEqual([
            "0 USDC paid",
            "0.02 USDC refunded",
        ]);
        expect(payments.metricLines).toEqual([
            [{ text: "0 USDC paid", amount: true, money: false }],
        ]);
    });

    it("draws a host metric over 24 characters as its amount, and a short one whole", () => {
        const call = (i: number): SessionEvent => ({
            at,
            kind: "x402",
            host: i < 100 ? "big.example" : "small.example",
            method: "GET",
            path: "/",
            status: i % 100 === 0 ? "paid" : "free",
            reason: "",
            count: 1,
            askedMicros: i % 100 === 0 ? 12_345_678 : 0,
            amountMicros: i % 100 === 0 ? 12_345_678 : 0,
            asset: "USDC",
            network: "n",
            resolved: i % 100 === 0 ? "paid" : null,
            resent: false,
        });
        const model = mapOf([
            { at, kind: "placement", phase: "placed", vcpu: 2, memoryMib: 2_048, minutes: 10 },
            ...Array.from({ length: 103 }, (_, i) => call(i)),
        ]);
        const placed = layoutMap(model, 720).placed;
        const host = (id: string) => placed.find((p) => p.node.id === `x402-host:${id}`)!;
        expect(host("big.example").node.metricParts.map((p) => p.text)).toEqual([
            "100 calls",
            "12.345678 USDC",
        ]);
        expect(host("big.example").metricLines).toEqual([
            [{ text: "12.345678 USDC", amount: true, money: true }],
        ]);
        expect(drawn(host("small.example").metricLines)).toEqual([["3 calls", "12.345678 USDC"]]);
    });
});
