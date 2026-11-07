// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { copy } from "../copy.ts";
import { formatClock, formatUsdc, shortSignature } from "../format.ts";
import { parseGetBody, type SessionRecord } from "../payload.ts";
import { makeScenarios, type ScenarioName } from "../testing/fixtures.ts";
import { layoutMap } from "./layout.ts";
import { renderMapList } from "./list.ts";
import { accessibleName, buildMap, type MapModel, type MapNode } from "./model.ts";
import { FOCUS_GAP, fitLabels, renderMapSvg } from "./svg.ts";
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
    const svg = renderMapSvg(document, layoutMap(model, 900), {
        selectedId,
        onSelect,
        controls: "map-table-1",
    });
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
            "search-api.example, 5 calls, 0.024 USDC, 3 refused",
        );
        expect(name("refused-host:unregistered.example")).toBe(
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
            ["0.075 USDC paid", "map-metric money"],
        ]);
        expect(parts(bubble(svg, "allowance"), ".map-metric")).toEqual([
            ["0.05 USDC", "map-metric money"],
            ["paid in", "map-metric muted"],
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
        expect(labelLines(payments)).toEqual([["Payments"], ["0.075 USDC paid"]]);
        expect(payments.getAttribute("aria-label")).toBe("Payments, 0.075 USDC paid");
    });

    it("cuts a name the fonts draw wider than the layout reserved, ending it in an ellipsis", () => {
        const record = recordOf("ended-full");
        const host = "wallet-mwmwmwmwmwmwmwmwmwmwmw.example";
        const model = buildMap({
            ...record,
            events: [
                ...record.events,
                { at: now, kind: "secret_host", host, requests: 1, bytes: 1 },
            ],
        });
        const id = `secret-host:${host}`;
        const layout = layoutMap(model, 900);
        const svg = renderMapSvg(document, layout, { selectedId: null, onSelect: vi.fn() });
        // m and w draw wider than the layout's 7.5 px a character, as they do in Manrope
        const measure = (span: Element) =>
            Array.from(span.textContent ?? "").reduce((w, c) => w + ("mw".includes(c) ? 12 : 7), 0);
        for (const span of svg.querySelectorAll("tspan")) {
            Object.assign(span, { getComputedTextLength: () => measure(span) });
        }
        const name = () => bubble(svg, id).querySelector("tspan.map-name")!;
        expect(name().textContent).toBe(nodeOf(model, id).label);
        const before = [...svg.querySelectorAll("tspan")].map((t) => t.textContent);
        fitLabels(svg);
        const cut = name().textContent!;
        expect(cut.endsWith("…")).toBe(true);
        // Its room is its label's, the 24 characters of its name
        expect(measure(name())).toBeLessThanOrEqual(24 * 7.5);
        expect(cut.slice(0, -1)).toBe(nodeOf(model, id).label.slice(0, cut.length - 1));
        // Short names such as Payments, inside the room their metric line reserves, stay whole
        const after = [...svg.querySelectorAll("tspan")].map((t) => t.textContent);
        expect(after.filter((t, i) => t !== before[i])).toEqual([cut]);
        expect(bubble(svg, id).getAttribute("aria-label")).toBe(accessibleName(nodeOf(model, id)));
        expect(bubble(svg, id).querySelector("title")!.textContent).toBe(host);
        // A second pass starts again from the whole name, so it cuts no further
        fitLabels(svg);
        expect(name().textContent).toBe(cut);
    });

    it("leaves every name whole where the page cannot measure text", () => {
        const { svg } = svgOf(modelOf("ended-hostile"));
        const before = svg.textContent;
        fitLabels(svg);
        expect(svg.textContent).toBe(before);
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

    it("expands only the selected bubble, and names the table it opens", () => {
        const { svg } = svgOf(modelOf("ended-full"), "payments");
        for (const g of bubbles(svg)) {
            const selected = g.dataset.nodeId === "payments";
            expect(g.getAttribute("aria-expanded")).toBe(String(selected));
            expect(g.getAttribute("aria-controls")).toBe("map-table-1");
            expect(g.hasAttribute("aria-pressed")).toBe(false);
            expect(g.classList.contains("is-selected")).toBe(selected);
        }
        const { svg: none } = svgOf(modelOf("ended-full"), null);
        expect(bubbles(none).every((g) => g.getAttribute("aria-expanded") === "false")).toBe(true);
    });

    it("holds each bubble's keyboard ring, one gap outside its circle", () => {
        // The ring's 2 px offset and its 2 px width, as the page's other rings have
        expect(FOCUS_GAP).toBe(4);
        const layout = layoutMap(modelOf("ended-full"), 900);
        const svg = renderMapSvg(document, layout, { selectedId: null, onSelect: vi.fn() });
        for (const p of [layout.center, ...layout.placed]) {
            const g = bubble(svg, p.node.id);
            const circles = [...g.querySelectorAll("circle")].map((c) => c.getAttribute("class"));
            expect(circles).toEqual(["map-hit", "map-bubble", "map-focus"]);
            const ring = g.querySelector("circle.map-focus")!;
            const bubbleR = Number(g.querySelector("circle.map-bubble")!.getAttribute("r"));
            expect(Number(ring.getAttribute("r"))).toBeCloseTo(bubbleR + FOCUS_GAP, 1);
            expect(ring.getAttribute("cx")).toBe(
                g.querySelector(".map-bubble")!.getAttribute("cx"),
            );
            expect(ring.getAttribute("cy")).toBe(
                g.querySelector(".map-bubble")!.getAttribute("cy"),
            );
        }
    });

    it("keeps a translator off the map, whose names are hosts and ports", () => {
        const { svg } = svgOf(modelOf("ended-full"));
        expect(svg.classList.contains("map-svg")).toBe(true);
        expect(svg.classList.contains("notranslate")).toBe(true);
    });

    it("draws money and refused edges with their classes, and labels only refusals", () => {
        const { svg } = svgOf(modelOf("ended-full"));
        const line = (id: string) =>
            [...svg.querySelectorAll("line")].find((l) => l.dataset.nodeId === id)!;
        expect(line("payments").classList.contains("money")).toBe(true);
        expect(line("refused-host:unregistered.example").classList.contains("warn")).toBe(true);
        // The dash is the stylesheet's, so it lives with the other sizes
        expect(
            line("refused-host:unregistered.example").getAttribute("stroke-dasharray"),
        ).toBeNull();
        expect(line("mcp").classList.contains("muted")).toBe(true);
        const labels = [...svg.querySelectorAll<SVGGElement>(".map-edge-label")];
        expect(labels.map((g) => [g.dataset.nodeId, g.textContent])).toEqual([
            ["x402-host:search-api.example", "3 refused"],
            ["refused-host:unregistered.example", "1 refused"],
        ]);
        for (const g of labels) {
            expect([...g.querySelectorAll("tspan")].map((t) => t.getAttribute("class"))).toEqual([
                "warn",
            ]);
        }
    });

    it("draws an edge label centred on its line, over a box one line tall", () => {
        const layout = layoutMap(modelOf("ended-full"), 900);
        const svg = renderMapSvg(document, layout, { selectedId: null, onSelect: vi.fn() });
        const id = "x402-host:search-api.example";
        const g = svg.querySelector(`.map-edge-label[data-node-id="${id}"]`)!;
        const texts = [...g.querySelectorAll("text")];
        expect(texts).toHaveLength(1);
        expectStacked(texts);
        expect(texts[0]!.getAttribute("text-anchor")).toBe("middle");
        expect(g.querySelector("rect")!.getAttribute("height")).toBe("16");
        const e = layout.edges.find((x) => x.to.node.id === id)!;
        expect(Number(texts[0]!.getAttribute("x"))).toBeCloseTo((e.x1 + e.x2) / 2, 1);
    });

    it("shows the sandbox alone with No calls recorded when the map is empty", () => {
        const { svg } = svgOf(modelOf("ended-empty"));
        expect(bubbles(svg)).toHaveLength(1);
        expect(svg.textContent).toContain(copy.noCalls);
    });
});

describe("renderMapList", () => {
    const listOf = (selectedId: string | null = null, onSelect = vi.fn()) => {
        const list = renderMapList(document, modelOf("ended-full"), {
            selectedId,
            onSelect,
            controls: "map-table-1",
        });
        document.body.replaceChildren(list);
        return { list, onSelect };
    };
    const rowOf = (list: Element, id: string) =>
        list.querySelector<HTMLButtonElement>(`[data-node-id="${id}"]`)!;

    it("gives one button per node, expanded when selected", () => {
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
            expect(b.getAttribute("aria-expanded")).toBe(String(node.id === "mcp"));
            expect(b.getAttribute("aria-controls")).toBe("map-table-1");
            expect(b.hasAttribute("aria-pressed")).toBe(false);
        }
        buttons[2]!.click();
        expect(onSelect).toHaveBeenCalledExactlyOnceWith(model.nodes[2]!.id);
    });

    it("shows a row's name, count and total paid, its whole metric in its name", () => {
        const { list } = listOf();
        const payments = rowOf(list, "payments");
        expect(payments.querySelector(".map-row-name")!.textContent).toBe("Payments");
        expect(payments.querySelector(".map-row-metric")!.textContent).toBe("0.075 USDC paid");
        expect(payments.getAttribute("aria-label")).toBe("Payments, 0.075 USDC paid");
        const search = rowOf(list, "x402-host:search-api.example");
        const metric = [...search.querySelectorAll(".map-row-metric > span")];
        expect(metric.map((s) => s.textContent)).toEqual(["5 calls", "0.024 USDC", "3 refused"]);
        expect(search.getAttribute("aria-label")).toBe(
            "search-api.example, 5 calls, 0.024 USDC, 3 refused",
        );
    });

    it("keeps a translator off each row's name and numbers", () => {
        const { list } = listOf();
        const search = rowOf(list, "x402-host:search-api.example");
        const kept = [...search.querySelectorAll('[translate="no"]')].map((e) => e.className);
        expect(kept).toEqual(["map-row-name", "muted", "money"]);
        // The refusal reads in words, so a translation may change it
        expect(search.querySelector(".map-row-refused")!.hasAttribute("translate")).toBe(false);
    });

    it("shows an Allowance with only a refund as 0 USDC paid in, never the refund", () => {
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
        expect(list.querySelector('[data-node-id="payments"]')).toBeNull();
        const row = list.querySelector('[data-node-id="allowance"]')!;
        expect(parts(row, ".map-row-metric span")[0]).toEqual(["0 USDC", "muted"]);
    });

    it("draws only the amounts of a row in the money colour", () => {
        const { list } = listOf();
        const search = rowOf(list, "x402-host:search-api.example");
        expect(parts(search, ".map-row-metric span")).toEqual([
            ["5 calls", "muted"],
            ["0.024 USDC", "money"],
            ["3 refused", "map-row-refused warn"],
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
        expect(row.querySelector(".warn")!.textContent).toBe("3 refused");
        const empty = renderMapList(document, modelOf("ended-empty"), {
            selectedId: null,
            onSelect: vi.fn(),
        });
        expect(empty.textContent).toContain(copy.noCalls);
    });
});

describe("renderEventTable", () => {
    const headsOf = (root: Element) =>
        [...root.querySelectorAll("thead th")].map((h) => [h.textContent, h.className]);

    it("has a head and one row per event, leaving out columns no row fills", () => {
        const node = nodeOf(modelOf("ended-full"), "mcp");
        const root = renderEventTable(document, node, { now, clipboard: clipboard() });
        expect(headsOf(root)).toEqual([
            ["Time", "ev-time"],
            ["Event", "ev-event"],
            ["Detail", "ev-detail"],
        ]);
        const rows = [...root.querySelectorAll("tbody tr")];
        expect(rows).toHaveLength(node.rows.length);
        const cells = [...rows[0]!.querySelectorAll("td")];
        expect(cells.map((c) => c.classList[0])).toEqual(["ev-time", "ev-event", "ev-detail"]);
        expect(cells.slice(0, 2).map((c) => c.textContent)).toEqual([
            formatClock(node.rows[0]!.at, now),
            node.rows[0]!.event,
        ]);
        const detail = [...cells[2]!.querySelectorAll(".parts > span")].map((p) => p.textContent);
        expect(detail).toEqual(node.rows[0]!.detail);
        expect(detail.length).toBeGreaterThan(1);
    });

    it("keeps the five headings in order when every column has a value", () => {
        const model = modelOf("ended-full");
        const payments = renderEventTable(document, nodeOf(model, "payments"), {
            now,
            clipboard: clipboard(),
        });
        expect(headsOf(payments)).toEqual([
            ["Time", "ev-time"],
            ["Event", "ev-event"],
            ["Amount", "ev-amount num"],
            ["Transaction", "ev-tx"],
        ]);
        const search = renderEventTable(document, nodeOf(model, "x402-host:search-api.example"), {
            now,
            clipboard: clipboard(),
        });
        const all = Object.values(copy.eventsHead);
        expect(headsOf(search).map(([text]) => text)).toEqual(all);
        expect(all).toEqual(["Time", "Event", "Detail", "Amount", "Transaction"]);
        for (const root of [payments, search]) {
            const shown = headsOf(root).map(([text]) => text);
            expect(shown).toEqual(all.filter((h) => shown.includes(h)));
            for (const tr of root.querySelectorAll("tbody tr")) {
                expect(tr.children).toHaveLength(shown.length);
            }
        }
    });

    it("pads each amount to the longest fraction in the table, so the points line up", () => {
        const node = nodeOf(modelOf("ended-full"), "payments");
        const root = renderEventTable(document, node, { now, clipboard: clipboard() });
        const amounts = [...root.querySelectorAll("tbody td.ev-amount")].map(
            (td) => td.textContent,
        );
        expect(amounts).toEqual(["0.050 USDC", "0.025 USDC"]);
    });

    it("names its table roles, so the phone's grid layout keeps the table's meaning", () => {
        const node = nodeOf(modelOf("ended-full"), "payments");
        const root = renderEventTable(document, node, { now, clipboard: clipboard() });
        const role = (sel: string) =>
            [...root.querySelectorAll(sel)].map((e) => e.getAttribute("role"));
        expect(role("table")).toEqual(["table"]);
        expect(role("thead, tbody")).toEqual(["rowgroup", "rowgroup"]);
        expect(new Set(role("tr"))).toEqual(new Set(["row"]));
        expect(new Set(role("th"))).toEqual(new Set(["columnheader"]));
        expect(new Set(role("td"))).toEqual(new Set(["cell"]));
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
            const short = shortSignature(tx);
            // The visible text first, then what the link does
            expect(a.getAttribute("aria-label")).toBe(`${short}, ${copy.openInExplorer}`);
            const button = a.closest("td")!.querySelector("button")!;
            expect(button.textContent).toContain(copy.copySignature);
            expect(button.getAttribute("aria-label")).toBe(copy.copySignatureOf(short));
            button.click();
            await Promise.resolve();
            expect(board.writeText).toHaveBeenLastCalledWith(tx);
        }
        expect(new Set(links.map((a) => a.textContent)).size).toBe(2);
    });

    it("keeps a translator off the detail and the transaction, and on the event", () => {
        const node = nodeOf(modelOf("ended-full"), "x402-host:search-api.example");
        const root = renderEventTable(document, node, { now, clipboard: clipboard() });
        const cells = [...root.querySelectorAll("tbody td")];
        expect(root.querySelector("td.ev-detail")).not.toBeNull();
        expect(root.querySelector("td.ev-tx")).not.toBeNull();
        for (const td of cells) {
            const kept = td.classList.contains("ev-detail") || td.classList.contains("ev-tx");
            expect(td.getAttribute("translate"), td.className).toBe(kept ? "no" : null);
        }
    });

    it("shows an invalid transaction as plain text, with no link and no copy button", () => {
        const node = nodeOf(modelOf("ended-hostile"), "payments");
        const root = renderEventTable(document, node, { now, clipboard: clipboard() });
        const row = [...root.querySelectorAll("tbody tr")].find(
            (tr) => tr.querySelector("td.ev-event")!.textContent === "Start payment",
        )!;
        const cell = row.querySelector("td.ev-tx")!;
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
        const amounts = [...root.querySelectorAll("tbody td.ev-amount")];
        const paid = amounts.filter((td) => td.textContent !== "");
        expect(paid.map((td) => td.textContent)).toEqual([formatUsdc(12_000), formatUsdc(12_000)]);
        expect(paid.every((td) => td.classList.contains("money"))).toBe(true);
        expect(amounts.filter((td) => td.classList.contains("money"))).toHaveLength(2);
        const tones = [...root.querySelectorAll("tbody td.ev-detail")].map((td) =>
            td.classList.contains("warn") ? "warn" : td.classList.contains("bad") ? "bad" : "",
        );
        // Every refusal reads in the warning colour, a seller out of reach included
        expect(tones).toEqual(["", "", "warn", "warn", "warn"]);
    });
});

describe("the x402 view", () => {
    const x402 = () => modelOf("ended-x402");
    const tableOf = (model: MapModel, id: string) =>
        renderEventTable(document, nodeOf(model, id), {
            now,
            clipboard: clipboard(),
            allowance: model.allowance,
        });
    // Each total's label, value and the value's tone
    const totalsOf = (root: Element) =>
        [...root.querySelectorAll("tfoot tr.total")].map((tr) => {
            const value = tr.querySelector("td.ev-amount")!;
            const tone = ["money", "muted"].find((c) => value.classList.contains(c)) ?? "";
            return [tr.querySelector("th")!.textContent, value.textContent, tone];
        });

    it("draws the Allowance under Payments, in the left column after Bugnet MCP", () => {
        const layout = layoutMap(x402(), 900);
        const left = layout.placed.filter((p) => p.node.side === "left");
        expect(left.map((p) => p.node.id)).toEqual(["mcp", "payments", "allowance"]);
        const { svg } = svgOf(x402());
        const circle = (id: string) => bubble(svg, id).querySelector("circle.map-bubble")!;
        const at = (id: string, a: string) => Number(circle(id).getAttribute(a));
        expect(at("allowance", "cx")).toBe(at("payments", "cx"));
        expect(at("allowance", "cy")).toBeGreaterThan(at("payments", "cy"));
        expect(labelLines(bubble(svg, "allowance"))).toEqual([
            ["Allowance"],
            ["0.1 USDC", "paid in"],
        ]);
    });

    it("draws each unregistered name's edge dashed in the warning colour, its name as text", () => {
        const model = x402();
        const { svg } = svgOf(model);
        const refused = model.nodes.filter((n) => n.kind === "refused-host");
        expect(refused.map((n) => [n.fullLabel, n.label])).toEqual([
            [copy.nodes.otherNames, copy.nodes.otherNames],
            ["mirror.example", "mirror.example"],
            // Cut to the label limit like any name, whole in the title
            ["pay.unknown-seller.example", "pay.unknown-seller.exam…"],
        ]);
        for (const node of refused) {
            const line = svg.querySelector(`line[data-node-id="${node.id}"]`)!;
            // The warn class dashes the line, from the stylesheet's --dash
            expect(line.getAttribute("class")).toBe("map-edge warn");
            const g = bubble(svg, node.id);
            expect(g.querySelector("title")!.textContent).toBe(node.fullLabel);
            expect(g.querySelector("tspan.map-name")!.textContent).toBe(node.label);
            expect(g.querySelector("a")).toBeNull();
        }
    });

    it("mutes a settling amount, never in the money colour", () => {
        const model = x402();
        const search = tableOf(model, "x402-host:search-api.example");
        const amounts = [...search.querySelectorAll("tbody tr")].flatMap((tr) => {
            const td = tr.querySelector("td.ev-amount")!;
            return td.textContent === "" ? [] : [[td.textContent, td.className]];
        });
        expect(amounts).toEqual([
            ["0.012 USDC", "ev-amount num money"],
            ["0.002 USDC", "ev-amount num muted"],
        ]);
        const data = tableOf(model, "x402-host:data-api.example");
        const settling = [...data.querySelectorAll("tbody td.ev-amount")].filter(
            (td) => td.textContent !== "",
        );
        expect(settling.map((td) => [td.textContent, td.className])).toEqual([
            ["0.005 USDC", "ev-amount num muted"],
        ]);
    });

    it("heads the Allowance table with its tip", () => {
        const root = tableOf(x402(), "allowance");
        const caption = root.querySelector("caption")!;
        expect(caption.firstElementChild!.textContent).toBe("Allowance");
        const button = caption.querySelector(".tip-button")!;
        expect(button.getAttribute("aria-label")).toBe("About the allowance");
        expect(caption.querySelector('[role="tooltip"]')!.textContent).toBe(copy.allowanceTip);
        // The tip's button would otherwise join the caption in the table's name
        expect(root.querySelector("table")!.getAttribute("aria-label")).toBe("Allowance");
        const payments = tableOf(x402(), "payments");
        expect(payments.querySelector(".tip")).toBeNull();
        expect(payments.querySelector("tfoot")).toBeNull();
    });

    it("lists the totals under the Allowance's rows, in order", () => {
        const root = tableOf(x402(), "allowance");
        const reason = (key: string, calls: number) => [
            copy.totals.refused(copy.x402.reason(key), calls),
            "",
            "",
        ];
        expect(totalsOf(root)).toEqual([
            ["Paid in", "0.100 USDC", "money"],
            ["Spent on search-api.example", "0.012 USDC", "money"],
            ["Spent on weather-api.example", "0.003 USDC", "money"],
            ["Settling, 2 calls", "0.007 USDC", "muted"],
            ["Refunded", "0.078 USDC", "money"],
            reason("allowance_spent", 41),
            reason("refused_host", 22),
            reason("body_too_large", 1),
            reason("network_unsupported", 1),
            reason("payee_changed", 1),
            reason("payments_unavailable", 1),
            reason("price_above_max", 1),
            reason("splits_unsupported", 1),
            reason("upstream_unreachable", 1),
        ]);
        expect(root.querySelector("tfoot")!.getAttribute("role")).toBe("rowgroup");
        // The rows' amounts and the totals' values share one column and one fraction
        const heads = [...root.querySelectorAll("thead th")].map((th) => th.textContent);
        expect(heads).toEqual(["Time", "Event", "Amount", "Transaction"]);
        for (const tr of root.querySelectorAll("tfoot tr.total")) {
            const th = tr.querySelector("th")!;
            expect(th.getAttribute("scope")).toBe("row");
            expect(th.getAttribute("colspan")).toBe("2");
            expect([...tr.children].map((c) => c.className)).toEqual([
                "total-label",
                expect.stringMatching(/^ev-amount num/),
                "ev-tx",
            ]);
        }
        const refund = [...root.querySelectorAll("tfoot tr.total")][4]!;
        const tx = x402().allowance!.refunded!.tx!;
        expect(refund.querySelector("a")!.getAttribute("href")).toBe(
            `https://explorer.solana.com/tx/${tx}`,
        );
        expect(refund.querySelector(".copy-button")).not.toBeNull();
    });

    it("shows the amount kept, with no settling line when nothing settles", () => {
        const model = modelOf("ended-x402-kept");
        expect(totalsOf(tableOf(model, "allowance"))).toEqual([
            ["Paid in", "0.050 USDC", "money"],
            ["Spent on search-api.example", "0.036 USDC", "money"],
            ["Spent on weather-api.example", "0.010 USDC", "money"],
            ["Kept under the minimum", "0.004 USDC", "money"],
        ]);
    });

    it("says the figures are being reconciled in place of the totals", () => {
        const root = tableOf(modelOf("ended-x402-reconcile"), "allowance");
        const foot = root.querySelector("tfoot")!;
        expect(foot.textContent).toBe("These figures are being reconciled.");
        expect(foot.querySelectorAll("tr")).toHaveLength(1);
        expect(foot.querySelector("td")!.getAttribute("colspan")).toBe("4");
        expect(totalsOf(root)).toEqual([]);
        expect(root.textContent).not.toContain(copy.totals.paidIn);
    });

    it("shows the parts of an Allowance row and a host row on a phone, none of them cut", () => {
        const list = renderMapList(document, x402(), { selectedId: null, onSelect: vi.fn() });
        const row = (id: string) => list.querySelector(`[data-node-id="${id}"]`)!;
        expect(parts(row("allowance"), ".map-row-metric > span")).toEqual([
            ["0.1 USDC", "money"],
            ["paid in", "muted"],
        ]);
        expect(parts(row("x402-host:search-api.example"), ".map-row-metric > span")).toEqual([
            ["45 calls", "muted"],
            ["0.012 USDC", "money"],
            ["1 settling", "muted"],
            ["43 refused", "map-row-refused warn"],
        ]);
        expect(parts(row("x402-host:data-api.example"), ".map-row-metric > span")).toEqual([
            ["6 calls", "muted"],
            ["1 settling", "muted"],
            ["3 refused", "map-row-refused warn"],
        ]);
    });

    it("never draws a middle dot", () => {
        // Spelled by its code point, since the page's code may not hold the character itself
        const MIDDLE_DOT = String.fromCodePoint(0xb7);
        const names: ScenarioName[] = [
            "ended-full",
            "ended-x402",
            "ended-x402-settling",
            "ended-x402-kept",
            "ended-x402-reconcile",
        ];
        for (const name of names) {
            const model = modelOf(name);
            const select = { selectedId: null, onSelect: vi.fn() };
            const roots: Element[] = [
                renderMapSvg(document, layoutMap(model, 900), select),
                renderMapList(document, model, select),
                ...model.nodes.map((n) => tableOf(model, n.id)),
            ];
            for (const root of roots) {
                const attrs = [root, ...root.querySelectorAll("*")].flatMap((e) =>
                    [...e.attributes].map((a) => a.value),
                );
                expect([root.textContent, ...attrs].join("\n"), name).not.toContain(MIDDLE_DOT);
            }
        }
    });
});
