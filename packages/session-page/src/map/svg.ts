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

// Each part takes its own class, so a count next to an amount never shows in the money colour
function lineSpans(doc: Document, lines: Span[][], x: string, sepClass: string): SVGTSpanElement[] {
    return lines.flatMap((line, row) =>
        line.flatMap((part, i) => {
            // A tspan with its own x starts a chunk that the anchor places on its own
            const at: Record<string, string> =
                i > 0 ? {} : row > 0 ? { x, dy: String(LINE_HEIGHT) } : { x };
            const span = tspan(doc, part.text, { ...at, class: part.class });
            return i > 0 ? [tspan(doc, copy.SEP, { class: sepClass }), span] : [span];
        }),
    );
}

function labelText(doc: Document, p: Placed): SVGTextElement {
    const x = num(p.labelX);
    const metric = p.metricLines.map((line) =>
        line.map((part) => ({
            text: part.text,
            class: part.money ? "map-metric money" : "map-metric muted",
        })),
    );
    return svgEl(
        doc,
        "text",
        {
            class: "map-label",
            x,
            y: num(p.labelY),
            "text-anchor": p.labelAnchor,
            fill: "currentColor",
        },
        lineSpans(
            doc,
            [[{ text: p.node.label, class: "map-name" }], ...metric],
            x,
            "map-metric muted",
        ),
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
            labelText(doc, p),
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

function edgeText(doc: Document, e: MapEdge): SVGTextElement {
    const x = num(e.box.x + e.box.width / 2);
    const lines = e.lines.map((line) =>
        line.map((part) => ({ text: part.text, class: part.tone })),
    );
    return svgEl(
        doc,
        "text",
        { x, y: num(e.box.y + ASCENT), "text-anchor": "middle", fill: "currentColor" },
        lineSpans(doc, lines, x, "muted"),
    );
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
        edgeText(doc, e),
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
