/**
 * Places the bubble map's nodes at fixed spots, so the same record always draws the same map.
 *
 * The sandbox sits in the centre with its name and size inside. Every other bubble's area grows
 * with its count on one scale, whose largest radius is set first by the most crowded place. Left
 * and right nodes stack in a column each, with labels on the outer side starting at one edge, and
 * each column moves inward only as far as its longest label needs. Bottom nodes spread along one
 * row under the centre, alternate their labels between two rows when one row cannot hold them, and
 * drop lower when their outer edges would cross a column. Counts and amounts show once, under each
 * bubble, so an edge carries a label only for refused calls, and the centre moves sideways only
 * when such a label needs the room. Label sizes are estimated at 7.5 px per character on 16 px
 * lines, plus a fixed gap between the parts of a line. The fonts draw some characters wider than
 * that, so the drawing cuts any name that runs past its label's room (svg.ts). The map is then
 * cropped to what it draws.
 */
import { copy } from "../copy.ts";
import type { MapModel, MapNode, MetricPart } from "./model.ts";

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
    metricLines: MetricPart[][];
}

export interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}

// Refusals are the only figure an edge shows
export interface EdgePart {
    text: string;
    tone: "warn";
}

export interface MapEdge {
    to: Placed;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    dashed: boolean;
    money: boolean;
    refusedLabel: string | null;
    // What the map draws, one array of parts per line, none for an edge with no refusals
    lines: EdgePart[][];
    // The background behind the drawn lines, centred on the line's midpoint
    box: Box;
}

export interface MapLayout {
    width: number;
    // The drawn area, from the top of its highest mark to the bottom of its lowest
    top: number;
    height: number;
    center: Placed;
    placed: Placed[];
    edges: MapEdge[];
    // Where an empty map's "No calls recorded." sits, centred on its baseline
    note: { x: number; y: number } | null;
}

export const CHAR_WIDTH = 7.5;
export const LINE_HEIGHT = 16;
export const ASCENT = 12;
// The page's --gap-inline, between the parts of one line
export const GAP = 16;

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
// The busiest bubble stays a mark beside the centre, and a one-event bubble still reads as one
const MAX_R = 36;
const MIN_R = 12;
const NOTE_BELOW = 28;
const MARGIN = 4;
const SPACE = 8;
const LINE_CHARS = 24;
const EDGE_PAD = 4;

const chars = (s: string) => Array.from(s).length;

function partsWidth(parts: readonly { text: string }[]): number {
    const text = parts.reduce((n, p) => n + chars(p.text), 0) * CHAR_WIDTH;
    return text + GAP * Math.max(0, parts.length - 1);
}

// A 720 px column holds about 26 characters, so a wider metric draws only its first amount
function metricLines(node: MapNode): MetricPart[][] {
    const parts = node.metricParts;
    if (parts.length === 0) return [];
    if (partsWidth(parts) <= LINE_CHARS * CHAR_WIDTH) return [parts];
    const amount = parts.find((p) => p.amount);
    return [amount ? [amount] : parts];
}

function labelWidth(node: MapNode, metricLines: MetricPart[][]): number {
    return Math.max(chars(node.label) * CHAR_WIDTH, ...metricLines.map(partsWidth));
}

// The width the layout keeps clear for a bubble's label, its widest line
export const labelRoom = (p: Placed) => labelWidth(p.node, p.metricLines);

const blockHeight = (metricLines: MetricPart[][]) => (1 + metricLines.length) * LINE_HEIGHT;

/* Edge labels */

function edgeLines(node: MapNode): EdgePart[][] {
    if (node.refused === 0) return [];
    return [[{ text: copy.metrics.refused(node.refused), tone: "warn" }]];
}

function formWidth(lines: EdgePart[][]): number {
    if (lines.length === 0) return 0;
    return Math.max(...lines.map(partsWidth)) + 2 * EDGE_PAD;
}

const edgeBoxWidth = (node: MapNode) => formWidth(edgeLines(node));

/* Columns */

interface Sized {
    node: MapNode;
    r: number;
    metricLines: MetricPart[][];
    width: number;
}

type Radius = (count: number) => number;

function sizeAll(nodes: MapNode[], radius: Radius): Sized[] {
    return nodes.map((node) => {
        const lines = metricLines(node);
        return { node, r: radius(node.count), metricLines: lines, width: labelWidth(node, lines) };
    });
}

const columnCap = (n: number) => COLUMN_SPAN / n / 2 - 6;

function placeColumn(
    nodes: MapNode[],
    side: "left" | "right",
    width: number,
    radius: Radius,
): Placed[] {
    if (nodes.length === 0) return [];
    const slot = COLUMN_SPAN / nodes.length;
    const sized = sizeAll(nodes, radius);
    const rMax = Math.max(...sized.map((s) => s.r));
    const reach = Math.max(...sized.map((s) => s.width)) + LABEL_GAP + rMax + MARGIN;
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
            labelX: side === "left" ? x - rMax - LABEL_GAP : x + rMax + LABEL_GAP,
            labelY: y - blockHeight(s.metricLines) / 2 + ASCENT,
            metricLines: s.metricLines,
        };
    });
}

/* Bottom row */

interface BottomRow {
    step: number;
    stagger: boolean;
}

// The step depends on the labels alone, so the scale's largest radius can be set from it first
function bottomRow(nodes: MapNode[], width: number): BottomRow {
    const n = nodes.length;
    if (n < 2) return { step: 0, stagger: false };
    const widths = nodes.map((node) => labelWidth(node, metricLines(node)));
    const room = width - 2 * MARGIN;
    const outer = (widths[0]! + widths[n - 1]!) / 2;
    const most = (room - outer) / (n - 1);
    const pair = (i: number, step: number) => (widths[i]! + widths[i + step]!) / 2 + SPACE;
    let flat = 0;
    for (let i = 0; i + 1 < n; i++) flat = Math.max(flat, pair(i, 1));
    let staggered = 0;
    for (let i = 0; i + 2 < n; i++) staggered = Math.max(staggered, pair(i, 2) / 2);
    const stagger = n > 2 && flat > most;
    const even = (width * (BOTTOM_TO - BOTTOM_FROM)) / (n - 1);
    // Edges fanning down meet their labels at about half the step, so those need room too
    const edges = 2 * (Math.max(...nodes.map((node) => edgeBoxWidth(node))) + SPACE);
    return { step: Math.min(most, Math.max(even, edges, stagger ? staggered : flat)), stagger };
}

function placeBottom(
    nodes: MapNode[],
    cx: number,
    width: number,
    rowY: number,
    radius: Radius,
    row: BottomRow,
): Placed[] {
    const n = nodes.length;
    if (n === 0) return [];
    const sized = sizeAll(nodes, radius);
    const { step, stagger } = row;
    const half = ((n - 1) * step) / 2;
    const middle = Math.min(
        Math.max(cx, MARGIN + half + sized[0]!.width / 2),
        width - MARGIN - half - sized[n - 1]!.width / 2,
    );
    const top = rowY + Math.max(...sized.map((s) => s.r)) + SPACE;
    const tier = Math.max(...sized.map((s) => blockHeight(s.metricLines))) + MARGIN;
    return sized.map((s, i) => {
        const x = middle + (i - (n - 1) / 2) * step;
        const drop = stagger && i % 2 === 1 ? tier : 0;
        return {
            node: s.node,
            x,
            y: rowY,
            r: s.r,
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
    radius: Radius,
    row: BottomRow,
): Placed[] {
    const at = (y: number) => placeBottom(nodes, center.x, width, y, radius, row);
    let placed = at(BOTTOM_Y);
    for (let y = BOTTOM_Y + DROP; y <= BOTTOM_Y + MAX_DROP; y += DROP) {
        const clear = placed.every((b) =>
            columns.every((c) => clearance(center, b, c) >= LINE_HEIGHT / 2 + SPACE),
        );
        if (clear) break;
        placed = at(y);
    }
    return placed;
}

/* Centre and edges */

// Moves the centre off the middle only when a column's widest edge label needs the room
function centerX(width: number, left: Placed[], right: Placed[]): number {
    const middle = width / 2;
    if (left.length === 0 || right.length === 0) return middle;
    const gap = (side: Placed[]) => Math.max(...side.map((p) => edgeBoxWidth(p.node)));
    const leftEdge = Math.max(...left.map((p) => p.x + p.r));
    const rightEdge = Math.min(...right.map((p) => p.x - p.r));
    const leftSpare = middle - CENTER_R - leftEdge - gap(left);
    const rightSpare = rightEdge - middle - CENTER_R - gap(right);
    if (rightSpare < 0 && leftSpare > 0) return middle - Math.min(-rightSpare, leftSpare);
    if (leftSpare < 0 && rightSpare > 0) return middle + Math.min(-leftSpare, rightSpare);
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
    const lines = edgeLines(node);
    return {
        to,
        ...ends,
        dashed: node.refused > 0 && node.refused === node.count,
        money: node.paidMicros > 0,
        refusedLabel: node.refused > 0 ? copy.metrics.refused(node.refused) : null,
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

// One square-root scale for every bubble but the centre, so equal counts draw equal bubbles
function radiusScale(nodes: MapNode[], caps: number[]): Radius {
    const cap = Math.min(MAX_R, ...caps);
    const most = Math.max(1, ...nodes.map((n) => n.count));
    const least = Math.min(MIN_R, cap);
    return (count) => Math.max(least, cap * Math.sqrt(Math.max(0, count) / most));
}

const circleBox = (p: Placed): Box => ({
    x: p.x - p.r,
    y: p.y - p.r,
    width: 2 * p.r,
    height: 2 * p.r,
});

export function layoutMap(model: MapModel, width: number): MapLayout {
    const sandbox = model.nodes.find((n) => n.side === "center");
    if (!sandbox) throw new Error("the map has no sandbox node");
    const on = (side: MapNode["side"]) => model.nodes.filter((n) => n.side === side);
    const [leftNodes, rightNodes, bottomNodes] = [on("left"), on("right"), on("bottom")];
    const row = bottomRow(bottomNodes, width);
    const radius = radiusScale(
        [...leftNodes, ...rightNodes, ...bottomNodes],
        [
            ...[leftNodes, rightNodes].filter((c) => c.length > 0).map((c) => columnCap(c.length)),
            ...(bottomNodes.length > 1 ? [row.step / 2 - SPACE / 2] : []),
        ],
    );
    const left = placeColumn(leftNodes, "left", width, radius);
    const right = placeColumn(rightNodes, "right", width, radius);
    const cx = centerX(width, left, right);
    const centerLines = sandbox.metricParts.map((part) => [part]);
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
    const placed = [
        ...columns,
        ...placeBottomClear(bottomNodes, center, columns, width, radius, row),
    ];
    const edges = placed.map((p) => edgeTo(center, p));
    const note = placed.length === 0 ? { x: cx, y: CENTER_Y + CENTER_R + NOTE_BELOW } : null;
    const ink = [
        ...[center, ...placed].map(circleBox),
        ...placed.map(labelBox),
        ...edges.filter((e) => e.lines.length > 0).map((e) => e.box),
        ...(note === null
            ? []
            : [{ x: note.x, y: note.y - ASCENT, width: 0, height: LINE_HEIGHT }]),
    ];
    const top = Math.min(...ink.map((b) => b.y));
    const bottom = Math.max(...ink.map((b) => b.y + b.height));
    return { width, top, height: bottom - top, center, placed, edges, note };
}
