import { copy } from "../copy.ts";
import { svgEl } from "../render/dom.ts";
import { ASCENT, GAP, LINE_HEIGHT, type MapEdge, type MapLayout, type Placed } from "./layout.ts";
import { accessibleName, type MapSelect } from "./model.ts";

// One decimal keeps the markup short
const num = (v: number) => String(Math.round(v * 10) / 10);

// Half the page's 40 px row, so a small bubble is still a full-size target
const HIT_R = 20;

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

// One text per line, since Chromium sizes a text as if all its tspans ran on one line
function lineTexts(doc: Document, lines: Span[][], at: LineAt): SVGTextElement[] {
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
            line.map((part, i) =>
                tspan(
                    doc,
                    part.text,
                    i > 0 ? { class: part.class, dx: num(GAP) } : { class: part.class },
                ),
            ),
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
    return lineTexts(doc, [[{ text: p.node.label, class: "map-name" }], ...metric], {
        class: "map-label",
        x: p.labelX,
        y: p.labelY,
        anchor: p.labelAnchor,
    });
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
            svgEl(doc, "circle", {
                class: "map-hit",
                cx: num(p.x),
                cy: num(p.y),
                r: num(Math.max(p.r, HIT_R)),
            }),
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
    return lineTexts(doc, lines, at);
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
    const { width, top, height, note } = layout;
    const svg = svgEl(doc, "svg", {
        class: "map-svg",
        role: "group",
        "aria-label": copy.mapLabel,
        viewBox: `0 ${num(top)} ${num(width)} ${num(height)}`,
        width: num(width),
        height: num(height),
    });
    // Each bubble names its own count, so the lines and their numbers stay out of reading order
    svg.append(
        svgEl(doc, "g", { class: "map-edges", "aria-hidden": "true" }, [
            ...layout.edges.map((e) => edgeLine(doc, e)),
            ...layout.edges.filter((e) => e.lines.length > 0).map((e) => edgeLabel(doc, e)),
        ]),
        ...[layout.center, ...layout.placed].map((p) => bubble(doc, p, opts)),
    );
    if (note !== null) {
        const text = svgEl(doc, "text", {
            class: "map-empty muted",
            x: num(note.x),
            y: num(note.y),
            "text-anchor": "middle",
            fill: "currentColor",
        });
        text.textContent = copy.noCalls;
        svg.append(text);
    }
    return svg;
}
