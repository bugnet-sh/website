/**
 * Places the bubble map's nodes at fixed spots, so the same record always draws the same map.
 *
 * The sandbox sits in the centre with its name and size inside. Left and right nodes stack in a
 * column each, with labels on the outer side, and each column moves inward only as far as its
 * longest label needs. Bottom nodes spread along one row under the centre, alternate their labels
 * between two rows when one row cannot hold them, and drop lower when their outer edges would cross
 * a column. The centre moves sideways only when an edge label needs the room, first for every
 * edge's shortest label, then for the amounts. Each edge label starts in its shortest form, then
 * takes the fullest form that clears every circle, label and other edge label. Label sizes are
 * estimated at 7.5 px per character on 16 px lines, wider than the page's fonts draw them.
 */
import { copy } from "../copy.ts";
import { SEPARATOR, type MapModel, type MapNode } from "./model.ts";

export interface Placed {
    node: MapNode;
    x: number;
    y: number;
    r: number;
    labelAnchor: "start" | "middle" | "end";
    labelX: number;
    // The first line's baseline
    labelY: number;
    // The metric as drawn, one line beside a bubble and one line per part inside the centre
    metricLines: string[];
}

export interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}

export type EdgeTone = "muted" | "money" | "warn";

export interface EdgePart {
    text: string;
    tone: EdgeTone;
}

export interface MapEdge {
    to: Placed;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    // The edge label of session-page-ui.md 5 in full, such as "5 · 0.024 USDC" for calls and paid
    label: string;
    dashed: boolean;
    money: boolean;
    refusedLabel: string | null;
    // What the map draws, one array of parts per line, shorter than the full label where it must be
    lines: EdgePart[][];
    // The background behind the drawn lines, centred on the line's midpoint
    box: Box;
}

export interface MapLayout {
    width: number;
    height: number;
    center: Placed;
    placed: Placed[];
    edges: MapEdge[];
}

const CHAR_WIDTH = 7.5;
export const LINE_HEIGHT = 16;
export const ASCENT = 12;

const HEIGHT = 460;
const CENTER_Y = 190;
const CENTER_R = 56;
const COLUMN_TOP = 40;
const COLUMN_SPAN = 300;
const LEFT_AT = 0.24;
const RIGHT_AT = 0.76;
const BOTTOM_Y = 380;
const BOTTOM_FROM = 0.34;
const BOTTOM_TO = 0.66;
const DROP = 8;
const MAX_DROP = 120;
const LABEL_GAP = 12;
const MARGIN = 4;
const SPACE = 8;
const LINE_CHARS = 24;
const EDGE_PAD = 4;
// A fuller edge label keeps this far from everything, so it never sits flush against a neighbour
const EDGE_CLEAR = 2;

export function radiusFor(count: number): number {
    return Math.min(40, 16 + 5 * Math.sqrt(Math.max(0, count)));
}

const chars = (s: string) => Array.from(s).length;

// A label is two lines, and at 720 px a column holds about 26 characters beside a 40 px bubble,
// so a longer metric is drawn as its money alone; the aria-label and the list keep it whole
function metricLines(node: MapNode): string[] {
    if (node.metric === "") return [];
    if (chars(node.metric) <= LINE_CHARS) return [node.metric];
    if (node.kind === "payments") return [copy.metrics.paid(node.paidMicros)];
    return [node.paidMicros > 0 ? copy.metrics.usdc(node.paidMicros) : node.metric];
}

function labelWidth(node: MapNode, metricLines: string[]): number {
    return Math.max(...[node.label, ...metricLines].map(chars)) * CHAR_WIDTH;
}

const blockHeight = (metricLines: string[]) => (1 + metricLines.length) * LINE_HEIGHT;

/* Edge labels */

interface EdgeText {
    label: string;
    refusedLabel: string | null;
    // Fullest first, the last is the one an edge keeps when nothing fuller fits
    forms: EdgePart[][][];
}

const lineText = (line: EdgePart[]) => line.map((part) => part.text).join(SEPARATOR);

// Counts stay muted (warn when every call was refused) and only amounts take the money tone
function edgeText(node: MapNode): EdgeText {
    const paid: EdgePart | null =
        node.paidMicros > 0 ? { text: copy.metrics.usdc(node.paidMicros), tone: "money" } : null;
    if (node.kind === "payments") {
        const total = paid ?? { text: copy.metrics.usdc(0), tone: "muted" };
        // Any other figure here would read as the total, so a total with no room leaves it bare
        return { label: total.text, refusedLabel: null, forms: [[[total]], []] };
    }
    const allRefused = node.refused > 0 && node.refused === node.count;
    const count: EdgePart = { text: String(node.count), tone: allRefused ? "warn" : "muted" };
    const full = paid ? [count, paid] : [count];
    const label = lineText(full);
    const kept = paid ? [full, [paid], [count]] : [full];
    if (node.refused === 0 || allRefused) {
        return { label, refusedLabel: null, forms: kept.map((parts) => [parts]) };
    }
    const refusedLabel = copy.metrics.refused(node.refused);
    const refused: EdgePart = { text: refusedLabel, tone: "warn" };
    const forms = kept.flatMap((parts) => [[[...parts, refused]], [parts, [refused]]]);
    // The refusals show nowhere else on the map, so they are the last thing an edge gives up
    forms.push([[refused]]);
    return { label, refusedLabel, forms };
}

function formWidth(lines: EdgePart[][]): number {
    if (lines.length === 0) return 0;
    return Math.max(...lines.map((line) => chars(lineText(line)))) * CHAR_WIDTH + 2 * EDGE_PAD;
}

// Need is the shortest form, want the shortest that still shows the money or says anything
type Room = "need" | "want";

function edgeBoxWidth(node: MapNode, room: Room = "need"): number {
    const { forms } = edgeText(node);
    if (room === "need") return formWidth(forms.at(-1)!);
    const money = forms.findLast((lines) => lines.flat().some((part) => part.tone === "money"));
    return formWidth(money ?? forms.findLast((lines) => lines.length > 0)!);
}

/* Columns */

interface Sized {
    node: MapNode;
    r: number;
    metricLines: string[];
    width: number;
}

function sizeAll(nodes: MapNode[], cap: number): Sized[] {
    return nodes.map((node) => {
        const lines = metricLines(node);
        return {
            node,
            r: Math.min(radiusFor(node.count), cap),
            metricLines: lines,
            width: labelWidth(node, lines),
        };
    });
}

function placeColumn(nodes: MapNode[], side: "left" | "right", width: number): Placed[] {
    if (nodes.length === 0) return [];
    const slot = COLUMN_SPAN / nodes.length;
    const sized = sizeAll(nodes, slot / 2 - 6);
    const reach = Math.max(...sized.map((s) => s.width + LABEL_GAP + s.r)) + MARGIN;
    const x =
        side === "left"
            ? Math.max(width * LEFT_AT, reach)
            : Math.min(width * RIGHT_AT, width - reach);
    return sized.map((s, i) => {
        const y = COLUMN_TOP + slot * (i + 0.5);
        return {
            node: s.node,
            x,
            y,
            r: s.r,
            labelAnchor: side === "left" ? "end" : "start",
            labelX: side === "left" ? x - s.r - LABEL_GAP : x + s.r + LABEL_GAP,
            labelY: y - blockHeight(s.metricLines) / 2 + ASCENT,
            metricLines: s.metricLines,
        };
    });
}

/* Bottom row */

function placeBottom(nodes: MapNode[], cx: number, width: number, rowY: number): Placed[] {
    const n = nodes.length;
    if (n === 0) return [];
    const sized = sizeAll(nodes, 40);
    const room = width - 2 * MARGIN;
    const outer = (sized[0]!.width + sized[n - 1]!.width) / 2;
    const most = n > 1 ? (room - outer) / (n - 1) : 0;
    const pair = (i: number, step: number) =>
        (sized[i]!.width + sized[i + step]!.width) / 2 + SPACE;
    let flat = 0;
    for (let i = 0; i + 1 < n; i++) flat = Math.max(flat, pair(i, 1));
    let staggered = 0;
    for (let i = 0; i + 2 < n; i++) staggered = Math.max(staggered, pair(i, 2) / 2);
    const stagger = n > 2 && flat > most;
    const even = n > 1 ? (width * (BOTTOM_TO - BOTTOM_FROM)) / (n - 1) : 0;
    // Edges fanning down meet their labels at about half the step, so those need room too
    const edges = 2 * (Math.max(...nodes.map((node) => edgeBoxWidth(node))) + SPACE);
    const step = Math.min(most, Math.max(even, edges, stagger ? staggered : flat));
    const r = sized.map((s) => (n > 1 ? Math.min(s.r, step / 2 - SPACE / 2) : s.r));
    const half = ((n - 1) * step) / 2;
    const middle = Math.min(
        Math.max(cx, MARGIN + half + sized[0]!.width / 2),
        width - MARGIN - half - sized[n - 1]!.width / 2,
    );
    const top = rowY + Math.max(...r) + SPACE;
    const tier = Math.max(...sized.map((s) => blockHeight(s.metricLines))) + MARGIN;
    return sized.map((s, i) => {
        const x = middle + (i - (n - 1) / 2) * step;
        const drop = stagger && i % 2 === 1 ? tier : 0;
        return {
            node: s.node,
            x,
            y: rowY,
            r: r[i]!,
            labelAnchor: "middle",
            labelX: x,
            labelY: top + drop + ASCENT,
            metricLines: s.metricLines,
        };
    });
}

// How far a line from the centre to `to` passes outside `other`'s circle
function clearance(center: { x: number; y: number }, to: Placed, other: Placed): number {
    const dx = to.x - center.x;
    const dy = to.y - center.y;
    const t = Math.min(
        1,
        Math.max(0, ((other.x - center.x) * dx + (other.y - center.y) * dy) / (dx * dx + dy * dy)),
    );
    return Math.hypot(center.x + t * dx - other.x, center.y + t * dy - other.y) - other.r;
}

// A wide row fans its outer edges under the side columns, so the row drops until they pass clear
function placeBottomClear(
    nodes: MapNode[],
    center: Placed,
    columns: Placed[],
    width: number,
): Placed[] {
    let row = placeBottom(nodes, center.x, width, BOTTOM_Y);
    for (let y = BOTTOM_Y + DROP; y <= BOTTOM_Y + MAX_DROP; y += DROP) {
        const clear = row.every((b) =>
            columns.every((c) => clearance(center, b, c) >= LINE_HEIGHT / 2 + SPACE),
        );
        if (clear) break;
        row = placeBottom(nodes, center.x, width, y);
    }
    return row;
}

/* Centre and edges */

// Moves the centre off the middle only when a column's widest edge label needs the room
function centerX(width: number, left: Placed[], right: Placed[]): number {
    const middle = width / 2;
    if (left.length === 0 || right.length === 0) return middle;
    const gap = (side: Placed[], room: Room) =>
        Math.max(...side.map((p) => edgeBoxWidth(p.node, room)));
    const leftEdge = Math.max(...left.map((p) => p.x + p.r));
    const rightEdge = Math.min(...right.map((p) => p.x - p.r));
    // Both sides' shortest labels come before either side's amounts
    for (const room of ["need", "want"] as const) {
        const leftSpare = middle - CENTER_R - leftEdge - gap(left, room);
        const rightSpare = rightEdge - middle - CENTER_R - gap(right, room);
        if (rightSpare < 0 && leftSpare > 0) return middle - Math.min(-rightSpare, leftSpare);
        if (leftSpare < 0 && rightSpare > 0) return middle + Math.min(-leftSpare, rightSpare);
    }
    return middle;
}

function boxAt(edge: { x1: number; y1: number; x2: number; y2: number }, lines: EdgePart[][]): Box {
    const width = formWidth(lines);
    const height = lines.length * LINE_HEIGHT;
    return {
        x: (edge.x1 + edge.x2) / 2 - width / 2,
        y: (edge.y1 + edge.y2) / 2 - height / 2,
        width,
        height,
    };
}

function edgeTo(center: Placed, to: Placed): MapEdge {
    const length = Math.hypot(to.x - center.x, to.y - center.y);
    const dx = (to.x - center.x) / length;
    const dy = (to.y - center.y) / length;
    const ends = {
        x1: center.x + dx * center.r,
        y1: center.y + dy * center.r,
        x2: to.x - dx * to.r,
        y2: to.y - dy * to.r,
    };
    const node = to.node;
    const { label, refusedLabel, forms } = edgeText(node);
    const lines = forms.at(-1)!;
    return {
        to,
        ...ends,
        label,
        dashed: node.refused > 0 && node.refused === node.count,
        money: node.paidMicros > 0,
        refusedLabel,
        lines,
        box: boxAt(ends, lines),
    };
}

function labelBox(p: Placed): Box {
    const width = labelWidth(p.node, p.metricLines);
    const before = { start: 0, middle: width / 2, end: width }[p.labelAnchor];
    return {
        x: p.labelX - before,
        y: p.labelY - ASCENT,
        width,
        height: blockHeight(p.metricLines),
    };
}

const boxesMeet = (a: Box, b: Box, gap: number) =>
    a.x < b.x + b.width + gap &&
    b.x < a.x + a.width + gap &&
    a.y < b.y + b.height + gap &&
    b.y < a.y + a.height + gap;

function circleMeetsBox(c: Placed, b: Box, gap: number): boolean {
    const nx = Math.min(Math.max(c.x, b.x), b.x + b.width);
    const ny = Math.min(Math.max(c.y, b.y), b.y + b.height);
    return Math.hypot(c.x - nx, c.y - ny) < c.r + gap;
}

function widenLabels(edges: MapEdge[], circles: Placed[], width: number, height: number) {
    const labels = circles.filter((c) => c.node.side !== "center").map(labelBox);
    const out = [...edges];
    for (const [i, edge] of out.entries()) {
        const others = out.filter((e, j) => j !== i && e.lines.length > 0);
        const blocks = [...labels, ...others.map((e) => e.box)];
        const fits = (b: Box) =>
            b.x >= EDGE_CLEAR &&
            b.y >= EDGE_CLEAR &&
            b.x + b.width <= width - EDGE_CLEAR &&
            b.y + b.height <= height - EDGE_CLEAR &&
            circles.every((c) => !circleMeetsBox(c, b, EDGE_CLEAR)) &&
            blocks.every((other) => !boxesMeet(other, b, EDGE_CLEAR));
        for (const lines of edgeText(edge.to.node).forms.slice(0, -1)) {
            const box = boxAt(edge, lines);
            if (fits(box)) {
                out[i] = { ...edge, lines, box };
                break;
            }
        }
    }
    return out;
}

export function layoutMap(model: MapModel, width: number): MapLayout {
    const sandbox = model.nodes.find((n) => n.side === "center");
    if (!sandbox) throw new Error("the map has no sandbox node");
    const on = (side: MapNode["side"]) => model.nodes.filter((n) => n.side === side);
    const left = placeColumn(on("left"), "left", width);
    const right = placeColumn(on("right"), "right", width);
    const cx = centerX(width, left, right);
    const centerLines = sandbox.metric === "" ? [] : sandbox.metric.split(SEPARATOR);
    const center: Placed = {
        node: sandbox,
        x: cx,
        y: CENTER_Y,
        r: CENTER_R,
        labelAnchor: "middle",
        labelX: cx,
        labelY: CENTER_Y - blockHeight(centerLines) / 2 + ASCENT,
        metricLines: centerLines,
    };
    const columns = [...left, ...right];
    const placed = [...columns, ...placeBottomClear(on("bottom"), center, columns, width)];
    // Only a bottom row that had to drop or stagger its labels reaches below the usual height
    const height = Math.max(HEIGHT, ...placed.map(labelBox).map((b) => b.y + b.height));
    const edges = placed.map((p) => edgeTo(center, p));
    return {
        width,
        height,
        center,
        placed,
        edges: widenLabels(edges, [center, ...placed], width, height),
    };
}
