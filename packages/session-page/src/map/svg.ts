import { copy } from "../copy.ts";
import { svgEl } from "../render/dom.ts";
import {
    ASCENT,
    GAP,
    LINE_HEIGHT,
    labelRoom,
    type MapEdge,
    type MapLayout,
    type Placed,
} from "./layout.ts";
import { accessibleName, type MapSelect } from "./model.ts";

// One decimal keeps the markup short
const num = (v: number) => String(Math.round(v * 10) / 10);

// Half the page's 40 px row, so a small bubble is still a full-size target
const HIT_R = 20;

// The page's focus ring keeps a 2 px gap and is 2 px wide, so its circle sits 4 px out
export const FOCUS_GAP = 4;

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

// Each name the fit pass may cut, with the room the layout kept for it
const rooms = new WeakMap<Element, { whole: string; room: number }>();

function labelTexts(doc: Document, p: Placed): SVGTextElement[] {
    const metric = p.metricLines.map((line) =>
        line.map((part) => ({
            text: part.text,
            class: part.money ? "map-metric money" : "map-metric muted",
        })),
    );
    const texts = lineTexts(doc, [[{ text: p.node.label, class: "map-name" }], ...metric], {
        class: "map-label",
        x: p.labelX,
        y: p.labelY,
        anchor: p.labelAnchor,
    });
    // The sandbox's own name sits inside its circle and never comes from the sandbox side
    const name = texts[0]?.firstElementChild;
    if (p.node.side !== "center" && name)
        rooms.set(name, { whole: p.node.label, room: labelRoom(p) });
    return texts;
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
            "aria-expanded": String(selected),
            ...(opts.controls === undefined ? {} : { "aria-controls": opts.controls }),
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
            svgEl(doc, "circle", {
                class: "map-focus",
                cx: num(p.x),
                cy: num(p.y),
                r: num(p.r + FOCUS_GAP),
            }),
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

// A refused edge's warn class also dashes it, from the stylesheet's token
function edgeLine(doc: Document, e: MapEdge): SVGLineElement {
    return svgEl(doc, "line", {
        class: `map-edge ${tone(e)}`,
        x1: num(e.x1),
        y1: num(e.y1),
        x2: num(e.x2),
        y2: num(e.y2),
        stroke: "currentColor",
        "data-node-id": e.to.node.id,
    });
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

/*
 * The layout reserves 7.5 px a character, and the fonts draw some names wider, such as one full
 * of m and w. Each name that runs past its label's room loses characters from its end and takes
 * an ellipsis, so it never crosses a neighbour or the map's edge. Each pass starts again from the
 * whole name, since the fonts may have changed since the last. The whole name stays in the
 * bubble's title and accessible name. A page that cannot measure text leaves every name whole.
 */
export function fitLabels(svg: SVGSVGElement): void {
    for (const span of svg.querySelectorAll<SVGTSpanElement>("tspan.map-name")) {
        const fit = rooms.get(span);
        if (fit === undefined) continue;
        if (typeof span.getComputedTextLength !== "function") return;
        span.textContent = fit.whole;
        const points = Array.from(fit.whole);
        for (let keep = points.length - 1; keep > 0; keep--) {
            if (span.getComputedTextLength() <= fit.room) break;
            span.textContent = `${points.slice(0, keep).join("")}…`;
        }
    }
}

export function renderMapSvg(doc: Document, layout: MapLayout, opts: MapSelect): SVGSVGElement {
    const { width, top, height, note } = layout;
    // translate is an HTML attribute, so the SVG takes the class translators honour instead
    const svg = svgEl(doc, "svg", {
        class: "map-svg notranslate",
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
