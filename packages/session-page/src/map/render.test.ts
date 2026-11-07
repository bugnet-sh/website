// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { copy } from "../copy.ts";
import { formatClock, formatUsdc, shortSignature } from "../format.ts";
import { parseGetBody, type SessionRecord } from "../payload.ts";
import { makeScenarios, type ScenarioName } from "../testing/fixtures.ts";
import { layoutMap } from "./layout.ts";
import { renderMapList } from "./list.ts";
import { accessibleName, buildMap, type MapModel, type MapNode } from "./model.ts";
import { renderMapSvg } from "./svg.ts";
import { renderEventTable } from "./table.ts";

const now = new Date("2026-11-06T12:00:00Z");
const scenarios = makeScenarios(now);

function recordOf(name: ScenarioName): SessionRecord {
    const body = parseGetBody(scenarios[name].gets[0]!.body);
    if (body.state !== "ended") throw new Error(`expected ended, got ${body.state}`);
    return body.record;
}

const modelOf = (name: ScenarioName) => buildMap(recordOf(name));

function nodeOf(model: MapModel, id: string): MapNode {
    const node = model.nodes.find((n) => n.id === id);
    if (!node) throw new Error(`no node ${id}`);
    return node;
}

function svgOf(model: MapModel, selectedId: string | null = null, onSelect = vi.fn()) {
    const svg = renderMapSvg(document, layoutMap(model, 900), { selectedId, onSelect });
    document.body.replaceChildren(svg);
    return { svg, onSelect };
}

const bubbles = (root: Element) => [...root.querySelectorAll<SVGGElement>('[role="button"]')];
const bubble = (root: Element, id: string) => bubbles(root).find((g) => g.dataset.nodeId === id)!;

const clipboard = () => ({ writeText: vi.fn(async (_text: string) => {}) });

// Each drawn line is a text of its own, and each part of a line a tspan
function labelLines(g: Element): string[][] {
    return [...g.querySelectorAll("text.map-label")].map((t) =>
        [...t.querySelectorAll("tspan")].map((s) => s.textContent ?? ""),
    );
}

// Every line of a label shares its x and anchor, each one line height below the last, and each
// part after a line's first starts one 16 px gap after the part before it
function expectStacked(texts: Element[]): void {
    const first = texts[0]!;
    for (const [i, t] of texts.entries()) {
        expect(t.getAttribute("x")).toBe(first.getAttribute("x"));
        expect(t.getAttribute("text-anchor")).toBe(first.getAttribute("text-anchor"));
        const y = Number(t.getAttribute("y")) - Number(first.getAttribute("y"));
        expect(y).toBeCloseTo(i * 16, 1);
        expect(t.querySelector("[x], [y], [dy]")).toBeNull();
        const gaps = [...t.querySelectorAll("tspan")].map((s) => s.getAttribute("dx"));
        expect(gaps).toEqual(gaps.map((_, j) => (j === 0 ? null : "16")));
    }
}

const parts = (root: Element, selector: string) =>
    [...root.querySelectorAll(selector)].map((t) => [t.textContent, t.getAttribute("class")]);

describe("renderMapSvg", () => {
    it("labels the map and gives every bubble a name and a button role", () => {
        const model = modelOf("ended-full");
        const { svg } = svgOf(model);
        expect(svg.getAttribute("role")).toBe("group");
        expect(svg.getAttribute("aria-label")).toBe(copy.mapLabel);
        expect(svg.classList.contains("map-svg")).toBe(true);
        const all = bubbles(svg);
        expect(all.map((g) => g.dataset.nodeId)).toEqual(model.nodes.map((n) => n.id));
        for (const g of all) {
            const node = nodeOf(model, g.dataset.nodeId!);
            expect(g.getAttribute("tabindex")).toBe("0");
            const refused = node.refused > 0 ? [copy.metrics.refused(node.refused)] : [];
            const metric = node.metricParts.map((p) => p.text);
            expect(g.getAttribute("aria-label")).toBe(
                [node.fullLabel, ...metric, ...refused].join(", "),
            );
            expect(g.getAttribute("aria-label")).toBe(accessibleName(node));
            expect(g.querySelector("title")!.textContent).toBe(node.fullLabel);
        }
    });

    it("names a bubble's refusals, since its edge is hidden from screen readers", () => {
        const { svg } = svgOf(modelOf("ended-full"));
        const name = (id: string) => bubble(svg, id).getAttribute("aria-label");
        expect(name("x402-host:search-api.example")).toBe(
            "search-api.example, 5 calls, 0.024 USDC, 2 refused",
        );
        expect(name("x402-host:unregistered.example")).toBe(
            "unregistered.example, 1 call, 1 refused",
        );
        expect(name("x402-host:weather-api.example")).toBe(
            "weather-api.example, 3 calls, 0.006 USDC",
        );
        expect(name("mcp")).toBe("Bugnet MCP, 19 tool calls");
    });

    it("draws only the amounts of a metric in the money colour", () => {
        const { svg } = svgOf(modelOf("ended-full"));
        const search = bubble(svg, "x402-host:search-api.example");
        expect(parts(search, ".map-label tspan")).toEqual([
            ["search-api.example", "map-name"],
            ["5 calls", "map-metric muted"],
            ["0.024 USDC", "map-metric money"],
        ]);
        expect(parts(bubble(svg, "mcp"), ".map-metric")).toEqual([
            ["19 tool calls", "map-metric muted"],
        ]);
        expect(parts(bubble(svg, "payments"), ".map-metric")).toEqual([
            ["0.125 USDC paid", "map-metric money"],
        ]);
    });

    it("sets a hostile label as text, cut to 24 characters, its full text in the title", () => {
        const model = modelOf("ended-hostile");
        const { svg } = svgOf(model);
        expect(svg.querySelector("img")).toBeNull();
        expect(svg.querySelector("foreignObject")).toBeNull();
        const markup = model.nodes.find((n) => n.fullLabel.startsWith("<img"))!;
        const g = bubble(svg, markup.id);
        expect(g.querySelector("title")!.textContent).toBe("<img src=x onerror=alert(1)>");
        const name = g.querySelector("text tspan")!;
        expect(name.textContent).toBe(markup.label);
        expect(Array.from(name.textContent!)).toHaveLength(24);
        const long = model.nodes.find((n) => n.kind === "x402-host")!;
        expect(bubble(svg, long.id).querySelector("title")!.textContent).toBe(long.fullLabel);
        expect(svg.querySelectorAll("[style]")).toHaveLength(0);
        expect(svg.querySelectorAll("a")).toHaveLength(0);
    });

    it("draws every bubble label as two lines, the whole metric kept in its name", () => {
        const { svg } = svgOf(modelOf("ended-full"));
        for (const g of bubbles(svg).filter((b) => b.dataset.nodeId !== "sandbox")) {
            expect(labelLines(g), g.dataset.nodeId).toHaveLength(2);
        }
        for (const g of bubbles(svg)) expectStacked([...g.querySelectorAll("text.map-label")]);
        expect(labelLines(bubble(svg, "x402-host:search-api.example"))).toEqual([
            ["search-api.example"],
            ["5 calls", "0.024 USDC"],
        ]);
        expect(labelLines(bubble(svg, "sandbox"))).toEqual([
            ["Sandbox"],
            ["2 vCPU"],
            ["2 GiB"],
            ["15 min"],
        ]);
        const payments = bubble(svg, "payments");
        expect(labelLines(payments)).toEqual([["Payments"], ["0.125 USDC paid"]]);
        expect(payments.getAttribute("aria-label")).toBe(
            "Payments, 0.125 USDC paid, 0.02 USDC refunded",
        );
    });

    it("gives each bubble a hit circle of at least 20 px radius behind it", () => {
        const layout = layoutMap(modelOf("ended-full"), 900);
        const svg = renderMapSvg(document, layout, { selectedId: null, onSelect: vi.fn() });
        for (const p of [layout.center, ...layout.placed]) {
            const g = bubble(svg, p.node.id);
            const [hit, drawn] = [...g.querySelectorAll("circle")];
            expect(hit!.getAttribute("class")).toBe("map-hit");
            expect(drawn!.getAttribute("class")).toBe("map-bubble");
            expect(Number(hit!.getAttribute("r"))).toBeCloseTo(Math.max(p.r, 20), 1);
            expect(hit!.getAttribute("cx")).toBe(drawn!.getAttribute("cx"));
            expect(hit!.getAttribute("cy")).toBe(drawn!.getAttribute("cy"));
        }
    });

    it("crops its view box to the layout's drawn area", () => {
        const layout = layoutMap(modelOf("ended-full"), 900);
        const svg = renderMapSvg(document, layout, { selectedId: null, onSelect: vi.fn() });
        const box = (svg.getAttribute("viewBox") ?? "").split(" ").map(Number);
        expect(box[0]).toBe(0);
        expect(box[1]).toBeCloseTo(layout.top, 1);
        expect(box[2]).toBe(900);
        expect(box[3]).toBeCloseTo(layout.height, 1);
        expect(svg.getAttribute("height")).toBe(String(box[3]));
    });

    it("calls onSelect on Enter, Space or a click", () => {
        const { svg, onSelect } = svgOf(modelOf("ended-full"));
        const g = bubble(svg, "payments");
        g.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        expect(onSelect).toHaveBeenLastCalledWith("payments");
        const space = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
        bubble(svg, "mcp").dispatchEvent(space);
        expect(onSelect).toHaveBeenLastCalledWith("mcp");
        expect(space.defaultPrevented).toBe(true);
        bubble(svg, "ssh").dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(onSelect).toHaveBeenLastCalledWith("ssh");
        g.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
        expect(onSelect).toHaveBeenCalledTimes(3);
    });

    it("closes the selected bubble's table on Escape", () => {
        const { svg, onSelect } = svgOf(modelOf("ended-full"), "payments");
        bubble(svg, "mcp").dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        expect(onSelect).toHaveBeenCalledExactlyOnceWith("payments");
    });

    it("presses only the selected bubble", () => {
        const { svg } = svgOf(modelOf("ended-full"), "payments");
        for (const g of bubbles(svg)) {
            const selected = g.dataset.nodeId === "payments";
            expect(g.getAttribute("aria-pressed")).toBe(String(selected));
            expect(g.classList.contains("is-selected")).toBe(selected);
        }
        const { svg: none } = svgOf(modelOf("ended-full"), null);
        expect(bubbles(none).every((g) => g.getAttribute("aria-pressed") === "false")).toBe(true);
    });

    it("draws money and refused edges with their classes", () => {
        const { svg } = svgOf(modelOf("ended-full"));
        const line = (id: string) =>
            [...svg.querySelectorAll("line")].find((l) => l.dataset.nodeId === id)!;
        expect(line("payments").classList.contains("money")).toBe(true);
        expect(line("x402-host:unregistered.example").classList.contains("warn")).toBe(true);
        expect(
            line("x402-host:unregistered.example").getAttribute("stroke-dasharray"),
        ).toBeTruthy();
        expect(line("mcp").getAttribute("stroke-dasharray")).toBeNull();
        const label = (id: string) =>
            [...svg.querySelectorAll<SVGGElement>(".map-edge-label")].find(
                (g) => g.dataset.nodeId === id,
            )!;
        const parts = (id: string, tone: string) =>
            [...label(id).querySelectorAll(`tspan.${tone}`)].map((t) => t.textContent);
        expect(parts("payments", "money")).toEqual([formatUsdc(125_000)]);
        expect(parts("mcp", "muted")).toEqual(["19"]);
        expect(label("mcp").querySelector(".money")).toBeNull();
        const search = "x402-host:search-api.example";
        expect(parts(search, "money")).toEqual([formatUsdc(24_000)]);
        expect(parts(search, "warn")).toEqual(["2 refused"]);
        expect(parts("x402-host:unregistered.example", "warn")).toEqual(["1"]);
        expect(label(search).querySelector("text")!.classList.contains("money")).toBe(false);
    });

    it("draws each line of an edge label centred on its own, its parts a gap apart", () => {
        const { svg } = svgOf(modelOf("ended-full"));
        const g = svg.querySelector(
            '.map-edge-label[data-node-id="x402-host:search-api.example"]',
        )!;
        const texts = [...g.querySelectorAll("text")];
        expect(
            texts.map((t) =>
                [...t.querySelectorAll("tspan")].map((s) => [
                    s.textContent,
                    s.getAttribute("class"),
                ]),
            ),
        ).toEqual([
            [
                ["5", "muted"],
                ["0.024 USDC", "money"],
            ],
            [["2 refused", "warn"]],
        ]);
        expectStacked(texts);
        expect(texts[0]!.getAttribute("text-anchor")).toBe("middle");
        expect(g.querySelector("rect")!.getAttribute("height")).toBe("32");
    });

    it("draws the line but no label for an edge with nothing that fits", () => {
        const layout = layoutMap(modelOf("ended-full"), 900);
        const bare = {
            ...layout,
            edges: layout.edges.map((e) => (e.to.node.id === "payments" ? { ...e, lines: [] } : e)),
        };
        const svg = renderMapSvg(document, bare, { selectedId: null, onSelect: vi.fn() });
        expect(svg.querySelector('line[data-node-id="payments"]')).not.toBeNull();
        expect(svg.querySelector('.map-edge-label[data-node-id="payments"]')).toBeNull();
        expect(svg.querySelectorAll(".map-edge-label")).toHaveLength(layout.edges.length - 1);
    });

    it("shows the sandbox alone with No calls recorded when the map is empty", () => {
        const { svg } = svgOf(modelOf("ended-empty"));
        expect(bubbles(svg)).toHaveLength(1);
        expect(svg.textContent).toContain(copy.noCalls);
    });
});

describe("renderMapList", () => {
    const listOf = (selectedId: string | null = null, onSelect = vi.fn()) => {
        const list = renderMapList(document, modelOf("ended-full"), { selectedId, onSelect });
        document.body.replaceChildren(list);
        return { list, onSelect };
    };
    const rowOf = (list: Element, id: string) =>
        list.querySelector<HTMLButtonElement>(`[data-node-id="${id}"]`)!;

    it("gives one button per node, pressed when selected", () => {
        const model = modelOf("ended-full");
        const { list, onSelect } = listOf("mcp");
        expect(list.tagName).toBe("UL");
        expect(list.classList.contains("map-list")).toBe(true);
        const buttons = [...list.querySelectorAll("button")];
        expect(buttons).toHaveLength(model.nodes.length);
        for (const [i, b] of buttons.entries()) {
            const node = model.nodes[i]!;
            expect(b.textContent).toContain(node.label);
            expect(b.textContent).toContain(node.metricParts[0]?.text ?? "");
            expect(b.getAttribute("aria-pressed")).toBe(String(node.id === "mcp"));
        }
        buttons[2]!.click();
        expect(onSelect).toHaveBeenCalledExactlyOnceWith(model.nodes[2]!.id);
    });

    it("shows a row's name, count and total paid, its whole metric in its name", () => {
        const { list } = listOf();
        const payments = rowOf(list, "payments");
        expect(payments.querySelector(".map-row-name")!.textContent).toBe("Payments");
        expect(payments.querySelector(".map-row-metric")!.textContent).toBe("0.125 USDC paid");
        expect(payments.getAttribute("aria-label")).toBe(
            "Payments, 0.125 USDC paid, 0.02 USDC refunded",
        );
        const search = rowOf(list, "x402-host:search-api.example");
        const metric = [...search.querySelectorAll(".map-row-metric > span")];
        expect(metric.map((s) => s.textContent)).toEqual(["5 calls", "0.024 USDC"]);
        expect(search.getAttribute("aria-label")).toBe(
            "search-api.example, 5 calls, 0.024 USDC, 2 refused",
        );
    });

    it("shows Payments with nothing paid and a refund as 0 USDC paid alone", () => {
        const record = recordOf("ended-full");
        const money = (e: SessionRecord["events"][number]) =>
            e.kind === "payment" || e.kind === "allowance";
        const refund = record.events.filter(
            (e) => e.kind === "allowance" && e.phase === "refunded",
        );
        expect(refund).toHaveLength(1);
        const model = buildMap({
            ...record,
            events: [...record.events.filter((e) => !money(e)), ...refund],
        });
        const list = renderMapList(document, model, { selectedId: null, onSelect: vi.fn() });
        const row = list.querySelector('[data-node-id="payments"]')!;
        expect(parts(row, ".map-row-metric span")).toEqual([["0 USDC paid", "muted"]]);
    });

    it("draws only the amounts of a row in the money colour", () => {
        const { list } = listOf();
        const search = rowOf(list, "x402-host:search-api.example");
        expect(parts(search, ".map-row-metric span")).toEqual([
            ["5 calls", "muted"],
            ["0.024 USDC", "money"],
        ]);
        expect(parts(rowOf(list, "mcp"), ".map-row-metric span")).toEqual([
            ["19 tool calls", "muted"],
        ]);
    });

    it("closes the selected row's table on Escape", () => {
        const { list, onSelect } = listOf("payments");
        const escape = () => new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
        rowOf(list, "mcp").dispatchEvent(escape());
        expect(onSelect).toHaveBeenCalledExactlyOnceWith("payments");
        const none = listOf(null);
        rowOf(none.list, "mcp").dispatchEvent(escape());
        expect(none.onSelect).not.toHaveBeenCalled();
    });

    it("marks refusals, and says when nothing was recorded", () => {
        const { list } = listOf();
        const row = rowOf(list, "x402-host:search-api.example");
        expect(row.querySelector(".warn")!.textContent).toBe("2 refused");
        const empty = renderMapList(document, modelOf("ended-empty"), {
            selectedId: null,
            onSelect: vi.fn(),
        });
        expect(empty.textContent).toContain(copy.noCalls);
    });
});

describe("renderEventTable", () => {
    const heads = () => Object.values(copy.eventsHead);

    it("has a head with the five headings and one row per event", () => {
        const node = nodeOf(modelOf("ended-full"), "mcp");
        const root = renderEventTable(document, node, { now, clipboard: clipboard() });
        const th = [...root.querySelectorAll("thead th")].map((h) => h.textContent);
        expect(th).toEqual(heads());
        expect(th).toEqual(["Time", "Event", "Detail", "Amount", "Transaction"]);
        const rows = [...root.querySelectorAll("tbody tr")];
        expect(rows).toHaveLength(node.rows.length);
        const cells = [...rows[0]!.querySelectorAll("td")];
        expect(cells.slice(0, 2).map((c) => c.textContent)).toEqual([
            formatClock(node.rows[0]!.at, now),
            node.rows[0]!.event,
        ]);
        const detail = [...cells[2]!.querySelectorAll(".parts > span")].map((p) => p.textContent);
        expect(detail).toEqual(node.rows[0]!.detail);
        expect(detail.length).toBeGreaterThan(1);
    });

    it("links a valid transaction to the explorer, with a copy button", async () => {
        const node = nodeOf(modelOf("ended-full"), "payments");
        const board = clipboard();
        const root = renderEventTable(document, node, { now, clipboard: board });
        const links = [...root.querySelectorAll("a")];
        expect(links).toHaveLength(node.rows.length);
        for (const [i, a] of links.entries()) {
            const tx = node.rows[i]!.tx!;
            expect(a.getAttribute("href")).toBe(`https://explorer.solana.com/tx/${tx}`);
            expect(a.getAttribute("target")).toBe("_blank");
            expect(a.getAttribute("rel")).toBe("noreferrer noopener");
            expect(a.textContent).toBe(shortSignature(tx));
            const button = a.closest("td")!.querySelector("button")!;
            expect(button.textContent).toContain(copy.copySignature);
            button.click();
            await Promise.resolve();
            expect(board.writeText).toHaveBeenLastCalledWith(tx);
        }
        expect(new Set(links.map((a) => a.textContent)).size).toBe(4);
    });

    it("shows an invalid transaction as plain text, with no link and no copy button", () => {
        const node = nodeOf(modelOf("ended-hostile"), "payments");
        const root = renderEventTable(document, node, { now, clipboard: clipboard() });
        const row = [...root.querySelectorAll("tbody tr")].find(
            (tr) => tr.querySelector("td:nth-child(2)")!.textContent === "Start payment",
        )!;
        const cell = row.querySelector("td:last-child")!;
        expect(cell.querySelector("a")).toBeNull();
        expect(cell.querySelector("button")).toBeNull();
        expect(cell.textContent).toBe(shortSignature("javascript:alert(document.cookie)"));
        const x402 = nodeOf(
            modelOf("ended-hostile"),
            modelOf("ended-hostile").nodes.find((n) => n.kind === "x402-host")!.id,
        );
        const hostile = renderEventTable(document, x402, { now, clipboard: clipboard() });
        expect(hostile.querySelectorAll("a")).toHaveLength(0);
        expect(hostile.querySelector("img")).toBeNull();
        expect(hostile.textContent).toContain("/pay/<img src=x onerror=alert(1)>");
    });

    it("marks amounts as money and colours a row's detail by its tone", () => {
        const node = nodeOf(modelOf("ended-full"), "x402-host:search-api.example");
        const root = renderEventTable(document, node, { now, clipboard: clipboard() });
        const amounts = [...root.querySelectorAll("tbody td:nth-child(4)")];
        const paid = amounts.filter((td) => td.textContent !== "");
        expect(paid.map((td) => td.textContent)).toEqual([formatUsdc(12_000), formatUsdc(12_000)]);
        expect(paid.every((td) => td.classList.contains("money"))).toBe(true);
        expect(amounts.filter((td) => td.classList.contains("money"))).toHaveLength(2);
        const tones = [...root.querySelectorAll("tbody td:nth-child(3)")].map((td) =>
            td.classList.contains("warn") ? "warn" : td.classList.contains("bad") ? "bad" : "",
        );
        expect(tones).toEqual(["", "", "warn", "warn", "bad"]);
    });
});
