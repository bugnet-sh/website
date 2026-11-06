/**
 * Places the bubble map's nodes at fixed spots, so the same record always draws the same map.
 *
 * The sandbox sits in the centre with its name and size inside. Left and right nodes stack in a
 * column each, with labels on the outer side, and each column moves inward only as far as its
 * longest label needs. Bottom nodes spread along one row under the centre, alternate their labels
 * between two rows when one row cannot hold them, and drop lower when their outer edges would cross
 * a column. The centre moves sideways only when an edge label needs the room. Label sizes are
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
    // The metric as drawn, split at its separators where one line would be too long
    metricLines: string[];
}

export interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface MapEdge {
    to: Placed;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    label: string;
    dashed: boolean;
    money: boolean;
    refusedLabel: string | null;
    // The background behind the label, centred on the line's midpoint
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
// Without a bottom row the columns get the same space below as above
const COLUMNS_HEIGHT = 2 * COLUMN_TOP + COLUMN_SPAN;
// The sandbox alone sits near the top, with the line that says nothing was recorded under it
const EMPTY_Y = COLUMN_TOP + CENTER_R;
const EMPTY_HEIGHT = EMPTY_Y + CENTER_R + 48;
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

export function radiusFor(count: number): number {
    return Math.min(40, 16 + 5 * Math.sqrt(Math.max(0, count)));
}

const chars = (s: string) => Array.from(s).length;

function packLines(metric: string, maxChars: number): string[] {
    if (metric === "") return [];
    const lines: string[] = [];
    for (const part of metric.split(SEPARATOR)) {
        const last = lines.at(-1);
        if (last !== undefined && chars(last) + SEPARATOR.length + chars(part) <= maxChars) {
            lines[lines.length - 1] = `${last}${SEPARATOR}${part}`;
        } else {
            lines.push(part);
        }
    }
    return lines;
}

function labelWidth(node: MapNode, metricLines: string[]): number {
    return Math.max(...[node.label, ...metricLines].map(chars)) * CHAR_WIDTH;
}

const blockHeight = (metricLines: string[]) => (1 + metricLines.length) * LINE_HEIGHT;

// A part-refused edge shows its refusals in place of the count, which its node's metric holds
function edgeText(node: MapNode): { label: string; refusedLabel: string | null; shown: string } {
    const label = String(node.count);
    const partRefused = node.refused > 0 && node.refused < node.count;
    const refusedLabel = partRefused ? copy.metrics.refused(node.refused) : null;
    return { label, refusedLabel, shown: refusedLabel ?? label };
}

const edgeBoxWidth = (node: MapNode) => chars(edgeText(node).shown) * CHAR_WIDTH + 2 * EDGE_PAD;

/* Columns */

interface Sized {
    node: MapNode;
    r: number;
    metricLines: string[];
    width: number;
}

function sizeAll(nodes: MapNode[], cap: number): Sized[] {
    return nodes.map((node) => {
        const metricLines = packLines(node.metric, LINE_CHARS);
        return {
            node,
            r: Math.min(radiusFor(node.count), cap),
            metricLines,
            width: labelWidth(node, metricLines),
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
    const edges = 2 * (Math.max(...nodes.map(edgeBoxWidth)) + SPACE);
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
    const gap = (side: Placed[]) => Math.max(...side.map((p) => edgeBoxWidth(p.node)));
    const leftSpare = middle - CENTER_R - Math.max(...left.map((p) => p.x + p.r)) - gap(left);
    const rightSpare = Math.min(...right.map((p) => p.x - p.r)) - middle - CENTER_R - gap(right);
    if (rightSpare < 0 && leftSpare > 0) return middle - Math.min(-rightSpare, leftSpare);
    if (leftSpare < 0 && rightSpare > 0) return middle + Math.min(-leftSpare, rightSpare);
    return middle;
}

function edgeTo(center: Placed, to: Placed): MapEdge {
    const length = Math.hypot(to.x - center.x, to.y - center.y);
    const dx = (to.x - center.x) / length;
    const dy = (to.y - center.y) / length;
    const x1 = center.x + dx * center.r;
    const y1 = center.y + dy * center.r;
    const x2 = to.x - dx * to.r;
    const y2 = to.y - dy * to.r;
    const node = to.node;
    const { label, refusedLabel } = edgeText(node);
    const boxWidth = edgeBoxWidth(node);
    return {
        to,
        x1,
        y1,
        x2,
        y2,
        label,
        dashed: node.refused > 0 && node.refused === node.count,
        money: node.paidMicros > 0,
        refusedLabel,
        box: {
            x: (x1 + x2) / 2 - boxWidth / 2,
            y: (y1 + y2) / 2 - LINE_HEIGHT / 2,
            width: boxWidth,
            height: LINE_HEIGHT,
        },
    };
}

export function layoutMap(model: MapModel, width: number): MapLayout {
    const sandbox = model.nodes.find((n) => n.side === "center");
    if (!sandbox) throw new Error("the map has no sandbox node");
    const on = (side: MapNode["side"]) => model.nodes.filter((n) => n.side === side);
    const left = placeColumn(on("left"), "left", width);
    const right = placeColumn(on("right"), "right", width);
    const cx = centerX(width, left, right);
    const centerLines = sandbox.metric === "" ? [] : sandbox.metric.split(SEPARATOR);
    const cy = model.nodes.length === 1 ? EMPTY_Y : CENTER_Y;
    const center: Placed = {
        node: sandbox,
        x: cx,
        y: cy,
        r: CENTER_R,
        labelAnchor: "middle",
        labelX: cx,
        labelY: cy - blockHeight(centerLines) / 2 + ASCENT,
        metricLines: centerLines,
    };
    const columns = [...left, ...right];
    const placed = [...columns, ...placeBottomClear(on("bottom"), center, columns, width)];
    const lowest = Math.max(...placed.map((p) => p.labelY - ASCENT + blockHeight(p.metricLines)));
    const height =
        placed.length === 0
            ? EMPTY_HEIGHT
            : Math.max(placed.length > columns.length ? HEIGHT : COLUMNS_HEIGHT, lowest);
    return { width, height, center, placed, edges: placed.map((p) => edgeTo(center, p)) };
}
