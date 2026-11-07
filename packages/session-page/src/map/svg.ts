import { copy } from "../copy.ts";
import { svgEl } from "../render/dom.ts";
import { ASCENT, LINE_HEIGHT, type MapEdge, type MapLayout, type Placed } from "./layout.ts";
import { accessibleName, type MapSelect } from "./model.ts";

// One decimal keeps the markup short
const num = (v: number) => String(Math.round(v * 10) / 10);

function tspan(doc: Document, value: string, attrs: Record<string, string>): SVGTSpanElement {
    const span = svgEl(doc, "tspan", attrs);
    span.textContent = value;
    return span;
}

interface Span {
    text: string;
    class: string;
}

interface LineAt {
    class?: string;
    x: number;
    // The baseline of the first line
    y: number;
    anchor: string;
}

/*
 * One text per line, since Chromium sizes a text as if all its tspans ran on one line, and a
 * label on the left would then read as wider than its box. Each part takes its own class, so a
 * count next to an amount never shows in the money colour.
 */
function lineTexts(doc: Document, lines: Span[][], at: LineAt, sepClass: string): SVGTextElement[] {
    return lines.map((line, row) =>
        svgEl(
            doc,
            "text",
            {
                ...(at.class === undefined ? {} : { class: at.class }),
                x: num(at.x),
                y: num(at.y + row * LINE_HEIGHT),
                "text-anchor": at.anchor,
                fill: "currentColor",
            },
            line.flatMap((part, i) => {
                const span = tspan(doc, part.text, { class: part.class });
                return i > 0 ? [tspan(doc, copy.SEP, { class: sepClass }), span] : [span];
            }),
        ),
    );
}

function labelTexts(doc: Document, p: Placed): SVGTextElement[] {
    const metric = p.metricLines.map((line) =>
        line.map((part) => ({
            text: part.text,
            class: part.money ? "map-metric money" : "map-metric muted",
        })),
    );
    return lineTexts(
        doc,
        [[{ text: p.node.label, class: "map-name" }], ...metric],
        { class: "map-label", x: p.labelX, y: p.labelY, anchor: p.labelAnchor },
        "map-metric muted",
    );
}

function bubble(doc: Document, p: Placed, opts: MapSelect): SVGGElement {
    const { node } = p;
    const selected = node.id === opts.selectedId;
    const title = svgEl(doc, "title");
    title.textContent = node.fullLabel;
    const g = svgEl(
        doc,
        "g",
        {
            class: selected ? "map-node is-selected" : "map-node",
            role: "button",
            tabindex: "0",
            "aria-pressed": String(selected),
            "aria-label": accessibleName(node),
            "data-node-id": node.id,
        },
        [
            title,
            svgEl(doc, "circle", { class: "map-bubble", cx: num(p.x), cy: num(p.y), r: num(p.r) }),
            ...labelTexts(doc, p),
        ],
    );
    g.addEventListener("click", () => opts.onSelect(node.id));
    g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            // Space would scroll the page
            e.preventDefault();
            opts.onSelect(node.id);
        } else if (e.key === "Escape" && opts.selectedId !== null) {
            opts.onSelect(opts.selectedId);
        }
    });
    return g;
}

function tone(e: MapEdge): string {
    if (e.dashed) return "warn";
    return e.money ? "money" : "muted";
}

function edgeLine(doc: Document, e: MapEdge): SVGLineElement {
    const attrs: Record<string, string> = {
        class: `map-edge ${tone(e)}`,
        x1: num(e.x1),
        y1: num(e.y1),
        x2: num(e.x2),
        y2: num(e.y2),
        stroke: "currentColor",
        "data-node-id": e.to.node.id,
    };
    if (e.dashed) attrs["stroke-dasharray"] = "6 4";
    return svgEl(doc, "line", attrs);
}

function edgeTexts(doc: Document, e: MapEdge): SVGTextElement[] {
    const lines = e.lines.map((line) =>
        line.map((part) => ({ text: part.text, class: part.tone })),
    );
    const at = { x: e.box.x + e.box.width / 2, y: e.box.y + ASCENT, anchor: "middle" };
    return lineTexts(doc, lines, at, "muted");
}

function edgeLabel(doc: Document, e: MapEdge): SVGGElement {
    return svgEl(doc, "g", { class: "map-edge-label", "data-node-id": e.to.node.id }, [
        svgEl(doc, "rect", {
            class: "map-edge-label-bg",
            x: num(e.box.x),
            y: num(e.box.y),
            width: num(e.box.width),
            height: num(e.box.height),
        }),
        ...edgeTexts(doc, e),
    ]);
}

export function renderMapSvg(doc: Document, layout: MapLayout, opts: MapSelect): SVGSVGElement {
    const { width, height, center } = layout;
    const svg = svgEl(doc, "svg", {
        class: "map-svg",
        role: "group",
        "aria-label": copy.mapLabel,
        viewBox: `0 0 ${num(width)} ${num(height)}`,
        width: num(width),
        height: num(height),
    });
    // Each bubble names its own count, so the lines and their numbers stay out of reading order
    svg.append(
        svgEl(doc, "g", { class: "map-edges", "aria-hidden": "true" }, [
            ...layout.edges.map((e) => edgeLine(doc, e)),
            ...layout.edges.filter((e) => e.lines.length > 0).map((e) => edgeLabel(doc, e)),
        ]),
        ...[center, ...layout.placed].map((p) => bubble(doc, p, opts)),
    );
    if (layout.placed.length === 0) {
        const note = svgEl(doc, "text", {
            class: "map-empty muted",
            x: num(center.x),
            y: num(center.y + center.r + 28),
            "text-anchor": "middle",
            fill: "currentColor",
        });
        note.textContent = copy.noCalls;
        svg.append(note);
    }
    return svg;
}
