// The parts of the anatomy kit (kit/iso-kit.ts) this site draws with, plus prisms along any
// axis from the kit's examples. Server-side only: it builds path strings once.

export type Flat = [number, number];
export type Point3 = [number, number, number];
export type Plane = [number, number];

export interface Projection {
    origin: Flat;
    scale: number;
    azimuth?: number;
    elevation?: number;
}

export interface Plan {
    x: number;
    y: number;
    w: number;
    d: number;
    r: number;
}

export interface SolidPaths {
    fill: string;
    outline: string;
    crease: string;
    top: string;
    shades: string[];
    bevel?: string;
}

export type Tone = "hi" | "mid" | "lo" | "faint";
export type LineTone = Tone | "lit";

const SHADES = 4;
const RADIANS = Math.PI / 180;
const UNIT = Math.sqrt(1.6);
const LIGHT_UP = 1.2;
const BANDS = [0, 0.2, 0.42, 0.62];

interface Camera {
    sinA: number;
    cosA: number;
    sinE: number;
    cosE: number;
    k: number;
}

export function cameraOf({ scale, azimuth = 45, elevation = 30 }: Projection): Camera {
    const a = azimuth * RADIANS;
    const e = elevation * RADIANS;
    return {
        sinA: Math.sin(a),
        cosA: Math.cos(a),
        sinE: Math.sin(e),
        cosE: Math.cos(e),
        k: scale * UNIT,
    };
}

export function iso([x, y, z]: Point3, projection: Projection): Flat {
    const { origin } = projection;
    const { sinA, cosA, sinE, cosE, k } = cameraOf(projection);
    return [
        origin[0] + (x * sinA - y * cosA) * k,
        origin[1] + ((x * cosA + y * sinA) * sinE - z * cosE) * k,
    ];
}

export function towardViewer(projection: Projection): Plane {
    const { sinA, cosA } = cameraOf(projection);
    return [cosA, sinA];
}

export function depthOf([x, y, z]: Point3, projection: Projection) {
    const { sinA, cosA, sinE, cosE } = cameraOf(projection);
    return (x * cosA + y * sinA) * cosE + z * sinE;
}

const tenth = (value: number) => {
    const text = (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, "");
    return text === "-0" ? "0" : text;
};

export function pathOf(points: Flat[], closed = false) {
    if (!points.length) return "";
    const d = points.map(([x, y], at) => `${at ? "L" : "M"}${tenth(x)} ${tenth(y)}`).join("");
    return closed ? `${d}Z` : d;
}

export function roundedPlan({ x, y, w, d, r }: Plan, steps = 8): Plane[] {
    const radius = Math.max(0, Math.min(r, w / 2, d / 2));
    const corners: [number, number, number][] = [
        [x + w - radius, y + radius, -90],
        [x + w - radius, y + d - radius, 0],
        [x + radius, y + d - radius, 90],
        [x + radius, y + radius, 180],
    ];
    const out: Plane[] = [];
    for (const [cx, cy, start] of corners) {
        const count = radius > 0 ? steps : 0;
        for (let step = 0; step <= count; step++) {
            const angle = (start + (count ? (90 * step) / count : 45)) * RADIANS;
            out.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
        }
    }
    return out;
}

function signedArea(points: Flat[]) {
    let area = 0;
    for (let index = 0; index < points.length; index++) {
        const [ax, ay] = points[index]!;
        const [bx, by] = points[(index + 1) % points.length]!;
        area += ax * by - bx * ay;
    }
    return area / 2;
}

const oriented = (points: Flat[]) => (signedArea(points) < 0 ? [...points].reverse() : points);

export function hullOf(points: Flat[]): Flat[] {
    const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (sorted.length < 3) return sorted;
    const cross = (o: Flat, a: Flat, b: Flat) =>
        (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower: Flat[] = [];
    for (const point of sorted) {
        while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, point) <= 0) lower.pop();
        lower.push(point);
    }
    const upper: Flat[] = [];
    for (let index = sorted.length - 1; index >= 0; index--) {
        const point = sorted[index]!;
        while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, point) <= 0) upper.pop();
        upper.push(point);
    }
    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function runsOf(flags: boolean[], want: boolean) {
    const count = flags.length;
    const runs: number[][] = [];
    const start = flags.findIndex((flag, index) => flag !== flags[(index + count - 1) % count]);
    if (start < 0) {
        return flags[0] === want ? [Array.from({ length: count + 1 }, (_, at) => at % count)] : [];
    }
    let run: number[] | null = null;
    for (let step = 0; step < count; step++) {
        const index = (start + step) % count;
        if (flags[index] === want) {
            if (!run) run = [index];
            run.push((index + 1) % count);
        } else if (run) {
            runs.push(run);
            run = null;
        }
    }
    if (run) runs.push(run);
    return runs;
}

/**
 * Each run of neighbouring side facets that share a tone, as one polygon in that tone's bucket:
 * the same area as the facets one by one, in far fewer bytes.
 */
function bandsOf(
    count: number,
    bucketOf: (index: number) => number,
    near: Flat[],
    far: Flat[],
    buckets: string[][],
) {
    const tones = Array.from({ length: count }, (_, index) => bucketOf(index));
    const start = tones.findIndex((tone, index) => tone !== tones[(index + count - 1) % count]);
    if (start < 0) {
        if (tones[0]! >= 0) {
            for (let index = 0; index < count; index++) {
                const next = (index + 1) % count;
                const quad = [near[index]!, near[next]!, far[next]!, far[index]!];
                buckets[tones[0]!]!.push(pathOf(oriented(quad), true));
            }
        }
        return;
    }
    let from = start;
    for (let step = 1; step <= count; step++) {
        const index = (start + step) % count;
        if (step < count && tones[index] === tones[from]) continue;
        const tone = tones[from]!;
        if (tone >= 0) {
            const run: number[] = [];
            for (let at = from; at !== index; at = (at + 1) % count) run.push(at);
            run.push(index);
            const strip = [...run.map((at) => near[at]!), ...run.reverse().map((at) => far[at]!)];
            buckets[tone]!.push(pathOf(oriented(strip), true));
        }
        from = index;
    }
}

function normalsOf(ring: Plane[]) {
    const count = ring.length;
    const counter = signedArea(ring) > 0;
    return ring.map(([ax, ay], index) => {
        const [bx, by] = ring[(index + 1) % count]!;
        const length = Math.hypot(bx - ax, by - ay) || 1;
        const dx = (bx - ax) / length;
        const dy = (by - ay) / length;
        return (counter ? [dy, -dx] : [-dy, dx]) as Plane;
    });
}

export function extrude(
    ring: Plane[],
    z: number,
    height: number,
    projection: Projection,
    bevel = 0,
): SolidPaths {
    const count = ring.length;
    const [vx, vy] = towardViewer(projection);
    const { sinA, cosA } = cameraOf(projection);
    const normals = normalsOf(ring);
    const facing = normals.map(([nx, ny]) => nx * vx + ny * vy > 1e-9);
    const top = ring.map(([x, y]) => iso([x, y, z + height], projection));
    const bottom = ring.map(([x, y]) => iso([x, y, z], projection));
    const outline: string[] = [];
    const crease: string[] = [];
    for (const run of runsOf(facing, false)) outline.push(pathOf(run.map((at) => top[at]!)));
    for (const run of runsOf(facing, true)) {
        crease.push(pathOf(run.map((at) => top[at]!)));
        if (height > 0) outline.push(pathOf(run.map((at) => bottom[at]!)));
    }
    if (height > 0) {
        for (let index = 0; index < count; index++) {
            if (facing[(index + count - 1) % count] !== facing[index]) {
                outline.push(pathOf([top[index]!, bottom[index]!]));
            }
        }
    }
    const buckets: string[][] = Array.from({ length: SHADES }, () => []);
    if (height > 0) {
        const shadeOf = (index: number) => {
            if (!facing[index]) return -1;
            const [nx, ny] = normals[index]!;
            const lit = (nx * -sinA + ny * cosA + 1) / 2;
            return Math.min(SHADES - 1, Math.max(0, Math.floor(lit * SHADES)));
        };
        bandsOf(count, shadeOf, top, bottom, buckets);
    }
    let edge: string | undefined;
    if (bevel > 0) {
        const inset = ring.map(([x, y], index) => {
            const [ax, ay] = normals[(index + count - 1) % count]!;
            const [bx, by] = normals[index]!;
            const length = Math.hypot(ax + bx, ay + by) || 1;
            return [x - ((ax + bx) / length) * bevel, y - ((ay + by) / length) * bevel] as Plane;
        });
        const insetTop = inset.map(([x, y]) => iso([x, y, z + height], projection));
        edge = runsOf(facing, true)
            .map((run) =>
                pathOf([
                    top[run[0]!]!,
                    ...run.slice(1, -1).map((at) => insetTop[at]!),
                    top[run.at(-1)!]!,
                ]),
            )
            .join("");
    }
    return {
        fill: pathOf(hullOf([...top, ...bottom]), true),
        outline: outline.join(""),
        crease: crease.join(""),
        top: pathOf(oriented(top), true),
        shades: buckets.map((paths) => paths.join("")),
        bevel: edge,
    };
}

export const slabOf = (
    plan: Plan,
    z: number,
    height: number,
    projection: Projection,
    steps = 4,
    bevel = 0,
) => extrude(roundedPlan(plan, steps), z, height, projection, bevel);

export function circleRing(cx: number, cy: number, radius: number, steps = 40): Plane[] {
    return Array.from({ length: steps }, (_, step) => {
        const angle = (step / steps) * Math.PI * 2;
        return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)] as Plane;
    });
}

export const cylinder = (
    cx: number,
    cy: number,
    radius: number,
    z: number,
    height: number,
    projection: Projection,
    steps = 32,
    bevel = 0,
) => extrude(circleRing(cx, cy, radius, steps), z, height, projection, bevel);

export const insetPlan = ({ x, y, w, d, r }: Plan, by: number): Plan => ({
    x: x + by,
    y: y + by,
    w: w - by * 2,
    d: d - by * 2,
    r: Math.max(0, r - by),
});

export const onTop = (points: Plane[], z: number, projection: Projection, closed = false) =>
    pathOf(
        points.map(([x, y]) => iso([x, y, z], projection)),
        closed,
    );

export const planOutline = (plan: Plan, z: number, projection: Projection, steps = 4) =>
    onTop(roundedPlan(plan, steps), z, projection, true);

export const segment = (from: Point3, to: Point3, projection: Projection) =>
    pathOf([iso(from, projection), iso(to, projection)]);

export const ring = (
    cx: number,
    cy: number,
    radius: number,
    z: number,
    projection: Projection,
    steps = 40,
) => onTop(circleRing(cx, cy, radius, steps), z, projection, true);

export function corners({ x, y, w, d }: Plan, inset = 0): Plane[] {
    return [
        [x + inset, y + inset],
        [x + w - inset, y + inset],
        [x + inset, y + d - inset],
        [x + w - inset, y + d - inset],
    ];
}

export function boxCorners({ x, y, w, d }: Plan, z0: number, z1: number): Point3[] {
    const out: Point3[] = [];
    for (const px of [x, x + w]) {
        for (const py of [y, y + d]) for (const z of [z0, z1]) out.push([px, py, z]);
    }
    return out;
}

/** The visible near half of a rounded plan at height z: a seam that wraps a box's corners. */
export function sideSeam(plan: Plan, z: number, projection: Projection, steps = 4) {
    const ring = roundedPlan(plan, steps);
    const [vx, vy] = towardViewer(projection);
    const facing = normalsOf(ring).map(([nx, ny]) => nx * vx + ny * vy > 1e-9);
    return runsOf(facing, true)
        .map((run) => pathOf(run.map((at) => iso([ring[at]![0], ring[at]![1], z], projection))))
        .join("");
}

export function sideArc(
    cx: number,
    cy: number,
    radius: number,
    z: number,
    projection: Projection,
    steps = 24,
) {
    const [vx, vy] = towardViewer(projection);
    const facing = Math.atan2(vy, vx);
    const points: Flat[] = [];
    for (let step = 0; step <= steps; step++) {
        const angle = facing - Math.PI / 2 + (step / steps) * Math.PI;
        points.push(
            iso([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), z], projection),
        );
    }
    return pathOf(points);
}

export function axisVector(projection: Projection, by: Point3): Flat {
    const origin = iso([0, 0, 0], projection);
    const moved = iso(by, projection);
    return [moved[0] - origin[0], moved[1] - origin[1]];
}

const thousandth = (value: number) => Math.round(value * 1000) / 1000;

/**
 * A transform that maps a group's local (x, -z) onto the vertical face at y = `at`, so text,
 * screens and dial faces can be drawn flat in that plane.
 */
export function frontMatrix(at: number, projection: Projection) {
    const origin = iso([0, at, 0], projection);
    const x = axisVector(projection, [1, 0, 0]);
    const down = axisVector(projection, [0, 0, -1]);
    return `matrix(${[x[0], x[1], down[0], down[1], origin[0], origin[1]].map(thousandth).join(" ")})`;
}

export interface FitOptions {
    pad?: number;
    azimuth?: number;
    elevation?: number;
}

export function fitProjection(
    points: Point3[],
    width: number,
    height: number,
    { pad = 24, azimuth = 45, elevation = 30 }: FitOptions = {},
): Projection {
    const unit: Projection = { origin: [0, 0], scale: 1, azimuth, elevation };
    const flat = points.map((point) => iso(point, unit));
    const xs = flat.map(([x]) => x);
    const ys = flat.map(([, y]) => y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const up = Math.min(...ys);
    const down = Math.max(...ys);
    const scale = Math.min((width - pad * 2) / (right - left), (height - pad * 2) / (down - up));
    return {
        origin: [width / 2 - ((left + right) / 2) * scale, height / 2 - ((up + down) / 2) * scale],
        scale,
        azimuth,
        elevation,
    };
}

// Prisms along any axis, for round parts that face the viewer: dial bezels, knobs, coins

const dot3 = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit3 = (a: Point3): Point3 => {
    const length = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / length, a[1] / length, a[2] / length];
};

export function viewOf(projection: Projection): Point3 {
    const { sinA, cosA, sinE, cosE } = cameraOf(projection);
    return [cosA * cosE, sinA * cosE, sinE];
}

function toneOf(normal: Point3, projection: Projection) {
    const { sinA, cosA } = cameraOf(projection);
    const score = dot3(unit3(normal), unit3([-sinA, cosA, LIGHT_UP]));
    let tone = 0;
    while (tone < BANDS.length && score >= BANDS[tone]!) tone++;
    return tone;
}

export interface Frame {
    o: Point3;
    a: Point3;
    u: Point3;
    v: Point3;
}

const along = (F: Frame, s: number, [x, y]: Plane): Point3 => [
    F.o[0] + F.a[0] * s + F.u[0] * x + F.v[0] * y,
    F.o[1] + F.a[1] * s + F.u[1] * x + F.v[1] * y,
    F.o[2] + F.a[2] * s + F.u[2] * x + F.v[2] * y,
];

export function prismOf(
    F: Frame,
    section: Plane[],
    s0: number,
    s1: number,
    projection: Projection,
): SolidPaths {
    const cross = (a: Plane, b: Plane) => a[0] * b[1] - a[1] * b[0];
    let area = 0;
    for (let index = 0; index < section.length; index++) {
        area += cross(section[index]!, section[(index + 1) % section.length]!);
    }
    const ring = area > 0 ? section : [...section].reverse();
    const count = ring.length;
    const view = viewOf(projection);
    const capNear = dot3(F.a, view) > 0;
    const [nearS, farS] = capNear ? [s1, s0] : [s0, s1];
    const near = ring.map((point) => iso(along(F, nearS, point), projection));
    const far = ring.map((point) => iso(along(F, farS, point), projection));
    const normals = ring.map(([x0, y0], index) => {
        const [x1, y1] = ring[(index + 1) % count]!;
        return unit3([
            F.u[0] * (y1 - y0) - F.v[0] * (x1 - x0),
            F.u[1] * (y1 - y0) - F.v[1] * (x1 - x0),
            F.u[2] * (y1 - y0) - F.v[2] * (x1 - x0),
        ]);
    });
    const facing = normals.map((normal) => dot3(normal, view) > 1e-9);
    const outline: string[] = [];
    const crease: string[] = [];
    for (const run of runsOf(facing, false)) outline.push(pathOf(run.map((at) => near[at]!)));
    for (const run of runsOf(facing, true)) {
        crease.push(pathOf(run.map((at) => near[at]!)));
        outline.push(pathOf(run.map((at) => far[at]!)));
    }
    for (let index = 0; index < count; index++) {
        if (facing[(index + count - 1) % count] !== facing[index]) {
            outline.push(pathOf([near[index]!, far[index]!]));
        }
    }
    const buckets: string[][] = [[], [], [], [], []];
    const bucketOf = (index: number) => (facing[index] ? toneOf(normals[index]!, projection) : -1);
    bandsOf(count, bucketOf, near, far, buckets);
    const capNormal: Point3 = capNear ? F.a : [-F.a[0], -F.a[1], -F.a[2]];
    buckets[toneOf(capNormal, projection)]!.push(pathOf(oriented(near), true));
    return {
        fill: pathOf(hullOf([...near, ...far]), true),
        outline: outline.join(""),
        crease: crease.join(""),
        top: buckets[4]!.join(""),
        shades: buckets.slice(0, 4).map((paths) => paths.join("")),
    };
}

export const frameY = (o: Point3): Frame => ({ o, a: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] });
export const frameX = (o: Point3): Frame => ({ o, a: [1, 0, 0], u: [0, -1, 0], v: [0, 0, 1] });

export const circleSection = (radius: number, steps = 40): Plane[] =>
    circleRing(0, 0, radius, steps);
