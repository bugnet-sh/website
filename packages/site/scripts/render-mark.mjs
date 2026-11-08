#!/usr/bin/env node
/*
 * Renders public/mark.png, the picture under the x402 band's Dither Veil: the Bugnet mark from
 * @bugnet/brand/logo.svg as a solid aluminium object at a three-quarter angle, lit like a studio
 * product shot on the page ground (#0a0a0a), so the veil reads the picture's edge as a plain matte
 * and only the mark takes dots.
 *
 * The logo's paths are flattened into rings, capsules and discs, and each part's exact 2D signed
 * distance (even-odd, so the eyes are holes) is sampled on a fine grid. A part is that distance
 * extruded to a thickness with a rounded bevel, the head and the antenna tips a little proud of the
 * wings. Each pixel is supersampled. A ray is clipped to the mark's box and sphere traced, and a hit
 * is shaded as metal, Schlick Fresnel over a neutral F0 times an analytic studio environment (a key
 * softbox, two fills, a strip light for the rim and a dim backdrop) averaged over a lobe as wide as
 * that part's roughness, then darkened by a short ambient occlusion probe. Light is mixed linear,
 * tone mapped and written as an 8-bit grey PNG with node:zlib. Rows are shared out to worker
 * threads. No dependencies.
 *
 * node scripts/render-mark.mjs [out.png] [--scale 0.25] [--samples 3]
 */
import { Buffer } from "node:buffer";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { URL, fileURLToPath } from "node:url";
import { Worker, isMainThread, workerData } from "node:worker_threads";
import { deflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const LOGO = resolve(HERE, "../../brand/logo.svg");

/* Picture */

const LONG_SIDE = 1200;
/* Room around the mark, as a share of its longer projected side */
const MARGIN = 0.05;
/* --bg, so the picture's ground and the page are one colour */
const GROUND = 10;
const EXPOSURE = 0.85;

/* Geometry, in logo units: object x right, y up, z toward the viewer, the viewBox's centre at 0 */

/* Each part's slab, back and front, and the radius of the bevel that rounds its edges */
const PARTS = {
    wings: { back: -28, front: 28, bevel: 14 },
    head: { back: -28, front: 40, bevel: 17 },
    stems: { back: -14, front: 22, bevel: 14 },
    tips: { back: -24, front: 40, bevel: 24 },
};
const GRID_STEP = 0.5;
const GRID_PAD = 24;

/* Camera and pose */

/* Close enough that the flat faces mirror a wide patch of the studio, so they carry a gradient */
const CAM = 4.5 * 693;
const YAW = -28;
const PITCH = -12;
const ROLL = -7;

/* Material */

/* Aluminium's reflectance with its slight warmth taken out, so the picture is grey */
const F0 = 0.9;
/*
 * The box is satin, so its faces keep the key's falloff from bright to dark; the bug is frosted, so
 * it averages the key into an even light and stands out of the box the way the dots need it to
 */
const ROUGH = { wings: 0.07, head: 0.28, stems: 0.22, tips: 0.22 };

/* Logo */

function attributes(tag) {
    return Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
}

/** An SVG arc from endpoint form to points, after the SVG spec's appendix on arcs */
function arcPoints(x1, y1, rx, ry, angle, large, sweep, x2, y2) {
    const phi = (angle * Math.PI) / 180;
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);
    const dx = (x1 - x2) / 2;
    const dy = (y1 - y2) / 2;
    const xp = cos * dx + sin * dy;
    const yp = -sin * dx + cos * dy;
    const grow = Math.max(1, Math.sqrt((xp * xp) / (rx * rx) + (yp * yp) / (ry * ry)));
    rx *= grow;
    ry *= grow;
    const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
    const den = rx * rx * yp * yp + ry * ry * xp * xp;
    const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
    const cxp = (k * rx * yp) / ry;
    const cyp = (-k * ry * xp) / rx;
    const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
    const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
    const turn = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    const ux = (xp - cxp) / rx;
    const uy = (yp - cyp) / ry;
    const start = turn(1, 0, ux, uy);
    let span = turn(ux, uy, (-xp - cxp) / rx, (-yp - cyp) / ry);
    if (!sweep && span > 0) span -= 2 * Math.PI;
    if (sweep && span < 0) span += 2 * Math.PI;
    const n = Math.max(8, Math.ceil((Math.abs(span) * Math.max(rx, ry)) / 1.2));
    const points = [];
    for (let i = 1; i <= n; i++) {
        const a = start + (span * i) / n;
        const ex = rx * Math.cos(a);
        const ey = ry * Math.sin(a);
        points.push([cos * ex - sin * ey + cx, sin * ex + cos * ey + cy]);
    }
    return points;
}

function bezierPoints(p) {
    let length = 0;
    for (let i = 1; i < p.length; i++) {
        length += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    }
    const n = Math.max(8, Math.ceil(length / 1.2));
    const points = [];
    for (let i = 1; i <= n; i++) {
        const t = i / n;
        let row = p;
        while (row.length > 1) {
            row = row
                .slice(1)
                .map((q, j) => [
                    row[j][0] + (q[0] - row[j][0]) * t,
                    row[j][1] + (q[1] - row[j][1]) * t,
                ]);
        }
        points.push(row[0]);
    }
    return points;
}

/** A path's subpaths as lists of points, absolute commands only, as logo.svg writes them */
function flatten(d) {
    const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
    const rings = [];
    let ring = null;
    let at = [0, 0];
    let i = 0;
    const num = () => Number(tokens[i++]);
    while (i < tokens.length) {
        const command = tokens[i++];
        if (command === "M") {
            at = [num(), num()];
            ring = [at];
            rings.push(ring);
        } else if (command === "L") {
            at = [num(), num()];
            ring.push(at);
        } else if (command === "C" || command === "Q") {
            const controls = Array.from({ length: command === "C" ? 3 : 2 }, () => [num(), num()]);
            ring.push(...bezierPoints([at, ...controls]));
            at = controls.at(-1);
        } else if (command === "A") {
            const [rx, ry, angle, large, sweep, x, y] = Array.from({ length: 7 }, num);
            ring.push(...arcPoints(at[0], at[1], rx, ry, angle, large, sweep, x, y));
            at = [x, y];
        } else if (command === "Z") {
            at = ring[0];
        } else {
            throw new Error(`render-mark: logo.svg uses the path command ${command}`);
        }
    }
    return rings;
}

/**
 * The logo as parts, in object coordinates: the stroked paths are the antenna stems, the circles
 * their tips, the even-odd path the head and the other filled paths the wings
 */
function readLogo() {
    const svg = readFileSync(LOGO, "utf8");
    const [vx, vy, vw, vh] = attributes(svg.match(/<svg[^>]*>/)[0])
        .viewBox.split(/\s+/)
        .map(Number);
    const cx = vx + vw / 2;
    const cy = vy + vh / 2;
    const toObject = (ring) => ring.map(([x, y]) => [x - cx, cy - y]);
    const parts = { wings: [], head: [], stems: [], tips: [] };
    for (const [tag] of svg.matchAll(/<(path|circle)\b[^>]*>/g)) {
        const a = attributes(tag);
        if (tag.startsWith("<circle")) {
            parts.tips.push({ disc: [Number(a.cx) - cx, cy - Number(a.cy), Number(a.r)] });
        } else if (a.fill === "none") {
            parts.stems.push({
                line: toObject(flatten(a.d)[0]),
                radius: Number(a["stroke-width"]) / 2,
            });
        } else {
            const rings = flatten(a.d).map(toObject);
            parts[a["fill-rule"] === "evenodd" ? "head" : "wings"].push({ rings });
        }
    }
    return { parts, half: [vw / 2, vh / 2] };
}

/* 2D signed distance */

function boxOf(points) {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** A shape as flat arrays for the workers: rings closed back to their first point */
function pack(shape) {
    if (shape.disc) return { disc: shape.disc };
    if (shape.line) {
        return { line: Float64Array.from(shape.line.flat()), radius: shape.radius };
    }
    return {
        rings: shape.rings.map((ring) => ({
            points: Float64Array.from([...ring, ring[0]].flat()),
            box: boxOf(ring),
        })),
    };
}

function boxDistance2(box, x, y) {
    const dx = Math.max(box[0] - x, 0, x - box[2]);
    const dy = Math.max(box[1] - y, 0, y - box[3]);
    return dx * dx + dy * dy;
}

/** Squared distance to a polyline, and whether a ray to +x crosses it an odd number of times */
let crossed = false;
function polylineDistance2(p, x, y, best) {
    for (let i = 2; i < p.length; i += 2) {
        const ax = p[i - 2];
        const ay = p[i - 1];
        const ex = p[i] - ax;
        const ey = p[i + 1] - ay;
        const wx = x - ax;
        const wy = y - ay;
        const t = Math.min(Math.max((wx * ex + wy * ey) / (ex * ex + ey * ey || 1), 0), 1);
        const ddx = wx - ex * t;
        const ddy = wy - ey * t;
        best = Math.min(best, ddx * ddx + ddy * ddy);
        if (ay > y !== p[i + 1] > y && x < ax + (ex * (y - ay)) / ey) crossed = !crossed;
    }
    return best;
}

function shapeDistance(shape, x, y) {
    if (shape.disc) return Math.hypot(x - shape.disc[0], y - shape.disc[1]) - shape.disc[2];
    if (shape.line) return Math.sqrt(polylineDistance2(shape.line, x, y, Infinity)) - shape.radius;
    let best = Infinity;
    let inside = false;
    for (const ring of shape.rings) {
        crossed = false;
        if (boxDistance2(ring.box, x, y) < best) best = polylineDistance2(ring.points, x, y, best);
        if (crossed) inside = !inside;
    }
    return inside ? -Math.sqrt(best) : Math.sqrt(best);
}

/* Rotation from the object frame to the world, columns are the object axes */

function rotation(yaw, pitch, roll) {
    const [cy, sy, cp, sp, cr, sr] = [yaw, pitch, roll].flatMap((deg) => {
        const a = (deg * Math.PI) / 180;
        return [Math.cos(a), Math.sin(a)];
    });
    const rz = [cr, -sr, 0, sr, cr, 0, 0, 0, 1];
    const rx = [1, 0, 0, 0, cp, -sp, 0, sp, cp];
    const ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
    const mul = (a, b) => {
        const m = new Array(9).fill(0);
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                for (let k = 0; k < 3; k++) m[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
            }
        }
        return m;
    };
    return mul(ry, mul(rx, rz));
}
const M = rotation(YAW, PITCH, ROLL);

const PART_NAMES = Object.keys(PARTS);
const Z_MIN = Math.min(...PART_NAMES.map((n) => PARTS[n].back));
const Z_MAX = Math.max(...PART_NAMES.map((n) => PARTS[n].front));

/* Studio environment, white light in world directions, y up and the camera on +z */

function smoothstep(a, b, x) {
    const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
    return t * t * (3 - 2 * t);
}

function norm3(v) {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
}

function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function frame(center, roll = 0) {
    const c = norm3(center);
    const up = Math.abs(c[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
    const u = norm3(cross(up, c));
    const v = cross(c, u);
    const cr = Math.cos((roll * Math.PI) / 180);
    const sr = Math.sin((roll * Math.PI) / 180);
    return [
        c,
        [0, 1, 2].map((i) => u[i] * cr + v[i] * sr),
        [0, 1, 2].map((i) => v[i] * cr - u[i] * sr),
    ];
}

/* Where the front faces mirror the camera, so the key can be placed with its soft edge across them */
const FACE_N = [M[2], M[5], M[8]];
const FACE_R = [
    2 * FACE_N[2] * FACE_N[0],
    2 * FACE_N[2] * FACE_N[1],
    2 * FACE_N[2] * FACE_N[2] - 1,
];
const [, FACE_U, FACE_V] = frame(FACE_R);
const offset = (a, b) => norm3([0, 1, 2].map((i) => FACE_R[i] + a * FACE_U[i] + b * FACE_V[i]));

function softbox(power, [c, u, v], hu, hv, soft) {
    return { power, c, u, v, hu, hv, soft };
}

const LIGHTS = [
    // The key, above and right, with only its soft edge on the faces so they fall from bright to
    // dark and the bevels that turn toward it flare
    softbox(3.2, frame(offset(0.148, 0.406), -20), 0.9, 0.3, 0.13),
    // A strip behind on the right, for the rim along the far edges
    softbox(3.0, frame([1, 0.15, -0.3]), 0.18, 0.8, 0.1),
    // A low fill for the bevels that face down
    softbox(0.9, frame(offset(-0.1, -0.62)), 0.7, 0.25, 0.3),
    // A faint one under the faces' dark end, so the foot of the box does not sink into the ground
    softbox(0.3, frame(offset(-0.16, -0.3), -20), 0.5, 0.12, 0.14),
];

function env(dx, dy, dz) {
    let radiance = 0.05 + 0.07 * smoothstep(-0.6, 1, dy);
    for (const l of LIGHTS) {
        const along = dx * l.c[0] + dy * l.c[1] + dz * l.c[2];
        if (along <= 0.05) continue;
        const pu = (dx * l.u[0] + dy * l.u[1] + dz * l.u[2]) / along;
        const pv = (dx * l.v[0] + dy * l.v[1] + dz * l.v[2]) / along;
        const inside =
            (1 - smoothstep(l.hu - l.soft, l.hu + l.soft, Math.abs(pu))) *
            (1 - smoothstep(l.hv - l.soft, l.hv + l.soft, Math.abs(pv)));
        if (inside > 0) radiance += l.power * inside * (1 - 0.35 * Math.min(1, (pu / l.hu) ** 2));
    }
    return radiance;
}

/* A fixed lobe of directions, turned per sample so the blur has no pattern */

const LOBE = 24;
const LOBE_DIRS = [];
for (let i = 0; i < LOBE; i++) {
    const y = 1 - (2 * (i + 0.5)) / LOBE;
    const rad = Math.sqrt(1 - y * y);
    const phi = i * 2.399963229728653;
    LOBE_DIRS.push([Math.cos(phi) * rad, y, Math.sin(phi) * rad]);
}

/* Tone mapping */

function aces(x) {
    return Math.min(Math.max((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0), 1);
}
function encode(linear) {
    const v = linear <= 0.0031308 ? 12.92 * linear : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
    return Math.round(Math.min(Math.max(v, 0), 1) * 255);
}
function decode(byte) {
    const v = byte / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/* Worker: the distance grids */

function gridRows({ parts, grid, buffers, first, step }) {
    for (let p = 0; p < PART_NAMES.length; p++) {
        const shapes = parts[PART_NAMES[p]];
        const field = new Float32Array(buffers[p]);
        for (let j = first; j < grid.rows; j += step) {
            const y = grid.y0 + j * GRID_STEP;
            for (let i = 0; i < grid.cols; i++) {
                const x = grid.x0 + i * GRID_STEP;
                let d = Infinity;
                for (const shape of shapes) d = Math.min(d, shapeDistance(shape, x, y));
                field[j * grid.cols + i] = d;
            }
        }
    }
}

/* Worker: the picture */

function renderRows({ grid, buffers, view, image, first, step, samples }) {
    const fields = buffers.map((b) => new Float32Array(b));
    const { cols, rows, x0, y0 } = grid;
    const settings = PART_NAMES.map((name) => {
        const { back, front, bevel } = PARTS[name];
        return { mid: (back + front) / 2, half: (front - back) / 2, bevel, rough: ROUGH[name] };
    });

    function field(f, x, y) {
        let gx = (x - x0) / GRID_STEP;
        let gy = (y - y0) / GRID_STEP;
        const cx = Math.min(Math.max(gx, 0), cols - 1.001);
        const cy = Math.min(Math.max(gy, 0), rows - 1.001);
        // Past the grid's edge the distance is at least the edge's plus the way back to it
        const outside = Math.hypot(gx - cx, gy - cy) * GRID_STEP;
        const i = Math.floor(cx);
        const j = Math.floor(cy);
        gx = cx - i;
        gy = cy - j;
        const at = j * cols + i;
        const top = f[at] + (f[at + 1] - f[at]) * gx;
        const bottom = f[at + cols] + (f[at + cols + 1] - f[at + cols]) * gx;
        return top + (bottom - top) * gy + outside;
    }

    let partHit = 0;
    function sdMark(x, y, z) {
        let d = Infinity;
        for (let p = 0; p < fields.length; p++) {
            const d2 = field(fields[p], x, y);
            // An extrusion is never nearer than its outline
            if (d2 >= d) continue;
            const s = settings[p];
            const qx = d2 + s.bevel;
            const qz = Math.abs(z - s.mid) - (s.half - s.bevel);
            const sd =
                Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) +
                Math.min(Math.max(qx, qz), 0) -
                s.bevel;
            if (sd < d) {
                d = sd;
                partHit = p;
            }
        }
        return d;
    }

    const bx = grid.half[0] + 2;
    const by = grid.half[1] + 2;
    const bz0 = Z_MIN - 2;
    const bz1 = Z_MAX + 2;
    let seed = 0;
    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };

    /** One ray from the camera, the linear light of its hit or -1 on a miss */
    function trace(wx, wy, wz) {
        const lx = M[0] * wx + M[3] * wy + M[6] * wz;
        const ly = M[1] * wx + M[4] * wy + M[7] * wz;
        const lz = M[2] * wx + M[5] * wy + M[8] * wz;
        const ox = M[6] * CAM;
        const oy = M[7] * CAM;
        const oz = M[8] * CAM;
        let t0 = 0;
        let t1 = Infinity;
        for (const [o, d, lo, hi] of [
            [ox, lx, -bx, bx],
            [oy, ly, -by, by],
            [oz, lz, bz0, bz1],
        ]) {
            if (Math.abs(d) < 1e-12) {
                if (o < lo || o > hi) return -1;
                continue;
            }
            const a = (lo - o) / d;
            const b = (hi - o) / d;
            t0 = Math.max(t0, Math.min(a, b));
            t1 = Math.min(t1, Math.max(a, b));
        }
        if (t0 >= t1) return -1;

        let t = t0;
        let hit = false;
        for (let i = 0; i < 400 && t < t1; i++) {
            const d = sdMark(ox + lx * t, oy + ly * t, oz + lz * t);
            if (d < 0.01) {
                hit = true;
                break;
            }
            t += Math.max(d * 0.8, 0.005);
        }
        if (!hit) return -1;

        const hx = ox + lx * t;
        const hy = oy + ly * t;
        const hz = oz + lz * t;
        sdMark(hx, hy, hz);
        const part = partHit;
        const e = 0.6;
        let nx = sdMark(hx + e, hy, hz) - sdMark(hx - e, hy, hz);
        let ny = sdMark(hx, hy + e, hz) - sdMark(hx, hy - e, hz);
        let nz = sdMark(hx, hy, hz + e) - sdMark(hx, hy, hz - e);
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl;
        ny /= nl;
        nz /= nl;

        let occ = 0;
        for (let k = 1; k <= 5; k++) {
            const h = 5 * k;
            occ += (1 - sdMark(hx + nx * h, hy + ny * h, hz + nz * h) / h) / 2 ** k;
        }
        const ao = Math.min(Math.max(1 - 1.3 * occ, 0.3), 1);

        const Nx = M[0] * nx + M[1] * ny + M[2] * nz;
        const Ny = M[3] * nx + M[4] * ny + M[5] * nz;
        const Nz = M[6] * nx + M[7] * ny + M[8] * nz;
        const dn = wx * Nx + wy * Ny + wz * Nz;
        const rx = wx - 2 * dn * Nx;
        const ry = wy - 2 * dn * Ny;
        const rz = wz - 2 * dn * Nz;
        const rough = settings[part].rough;

        const spin = random() * Math.PI * 2;
        const cs = Math.cos(spin);
        const sn = Math.sin(spin);
        let sum = 0;
        let weight = 0;
        for (const [ax, ay, az] of LOBE_DIRS) {
            let sx = rx + (ax * cs - az * sn) * rough;
            let sy = ry + ay * rough;
            let sz = rz + (ax * sn + az * cs) * rough;
            const sl = Math.hypot(sx, sy, sz);
            sx /= sl;
            sy /= sl;
            sz /= sl;
            if (sx * Nx + sy * Ny + sz * Nz <= 0) continue;
            const w = Math.max(0, sx * rx + sy * ry + sz * rz) ** 4;
            sum += env(sx, sy, sz) * w;
            weight += w;
        }
        const radiance = weight > 0 ? sum / weight : env(rx, ry, rz);
        const fresnel = F0 + (1 - F0) * (1 - Math.min(Math.max(-dn, 0), 1)) ** 5;
        return fresnel * radiance * ao * EXPOSURE;
    }

    const pixels = new Uint8Array(image);
    const { width, height, u0, u1, v0, v1 } = view;
    const ground = decode(GROUND);
    for (let y = first; y < height; y += step) {
        // Seeded by row, so the picture does not depend on how many threads drew it
        seed = 0x2f6b + y * 7919;
        for (let x = 0; x < width; x++) {
            let sum = 0;
            let hits = 0;
            for (let sy = 0; sy < samples; sy++) {
                for (let sx = 0; sx < samples; sx++) {
                    const u = u0 + ((x + (sx + 0.5) / samples) / width) * (u1 - u0);
                    const v = v1 - ((y + (sy + 0.5) / samples) / height) * (v1 - v0);
                    const len = Math.hypot(u, v, 1);
                    const light = trace(u / len, v / len, -1 / len);
                    if (light < 0) {
                        sum += ground;
                    } else {
                        sum += aces(light);
                        hits++;
                    }
                }
            }
            pixels[y * width + x] = hits ? encode(sum / (samples * samples)) : GROUND;
        }
    }
}

/* PNG, grey, each row with the filter that leaves it smallest */

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
function crc32(bytes) {
    let c = 0xffffffff;
    for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, "ascii");
    data.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
}
function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
function png(width, height, grey) {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header[8] = 8;
    header[9] = 0;
    const rows = Buffer.alloc((width + 1) * height);
    const line = new Uint8Array(width);
    for (let y = 0; y < height; y++) {
        let best = Infinity;
        for (let filter = 0; filter < 5; filter++) {
            let cost = 0;
            for (let x = 0; x < width; x++) {
                const v = grey[y * width + x];
                const a = x > 0 ? grey[y * width + x - 1] : 0;
                const b = y > 0 ? grey[(y - 1) * width + x] : 0;
                const c = x > 0 && y > 0 ? grey[(y - 1) * width + x - 1] : 0;
                const predicted = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter];
                line[x] = (v - predicted) & 0xff;
                cost += line[x] < 128 ? line[x] : 256 - line[x];
            }
            if (cost < best) {
                best = cost;
                rows[y * (width + 1)] = filter;
                rows.set(line, y * (width + 1) + 1);
            }
        }
    }
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return Buffer.concat([
        signature,
        chunk("IHDR", header),
        chunk("IDAT", deflateSync(rows, { level: 9 })),
        chunk("IEND", Buffer.alloc(0)),
    ]);
}

/* Main: frame the mark, then share the rows out */

function run(data) {
    return new Promise((done, fail) => {
        const worker = new Worker(new URL(import.meta.url), { workerData: data });
        worker.on("error", fail);
        worker.on("exit", (code) => (code === 0 ? done() : fail(new Error(`worker ${code}`))));
    });
}

async function main() {
    const args = process.argv.slice(2);
    const flag = (name, fallback) => {
        const at = args.indexOf(name);
        return at === -1 ? fallback : Number(args[at + 1]);
    };
    const positional = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
    const out = resolve(positional[0] ?? resolve(HERE, "../public/mark.png"));
    const scale = flag("--scale", 1);
    const samples = Math.max(1, Math.round(flag("--samples", 3)));
    const threads = availableParallelism();
    const started = Date.now();

    const logo = readLogo();
    const parts = Object.fromEntries(PART_NAMES.map((n) => [n, logo.parts[n].map(pack)]));
    const grid = {
        x0: -logo.half[0] - GRID_PAD,
        y0: -logo.half[1] - GRID_PAD,
        cols: Math.ceil((2 * (logo.half[0] + GRID_PAD)) / GRID_STEP) + 1,
        rows: Math.ceil((2 * (logo.half[1] + GRID_PAD)) / GRID_STEP) + 1,
        half: logo.half,
    };
    const buffers = PART_NAMES.map(() => new SharedArrayBuffer(grid.cols * grid.rows * 4));
    await Promise.all(
        Array.from({ length: threads }, (_, first) =>
            run({ task: "grid", parts, grid, buffers, first, step: threads }),
        ),
    );

    /* The image plane's window around every outline point, front and back, as the camera sees it */
    let [u0, v0, u1, v1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const name of PART_NAMES) {
        const outline = logo.parts[name].flatMap((s) =>
            s.disc
                ? Array.from({ length: 64 }, (_, k) => [
                      s.disc[0] + s.disc[2] * Math.cos((k * Math.PI) / 32),
                      s.disc[1] + s.disc[2] * Math.sin((k * Math.PI) / 32),
                  ])
                : (s.rings ?? [s.line]).flat(),
        );
        for (const [x, y] of outline) {
            for (const z of [PARTS[name].back, PARTS[name].front]) {
                const wx = M[0] * x + M[1] * y + M[2] * z;
                const wy = M[3] * x + M[4] * y + M[5] * z;
                const wz = M[6] * x + M[7] * y + M[8] * z;
                const u = wx / (CAM - wz);
                const v = wy / (CAM - wz);
                [u0, u1, v0, v1] = [
                    Math.min(u0, u),
                    Math.max(u1, u),
                    Math.min(v0, v),
                    Math.max(v1, v),
                ];
            }
        }
    }
    const room = MARGIN * Math.max(u1 - u0, v1 - v0);
    [u0, u1, v0, v1] = [u0 - room, u1 + room, v0 - room, v1 + room];
    const long = Math.round(LONG_SIDE * scale);
    const tall = v1 - v0 > u1 - u0;
    const width = tall ? Math.round((long * (u1 - u0)) / (v1 - v0)) : long;
    const height = tall ? long : Math.round((long * (v1 - v0)) / (u1 - u0));
    const view = { width, height, u0, u1, v0, v1 };

    const image = new SharedArrayBuffer(width * height);
    await Promise.all(
        Array.from({ length: threads }, (_, first) =>
            run({ task: "render", grid, buffers, view, image, first, step: threads, samples }),
        ),
    );

    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, png(width, height, new Uint8Array(image)));
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    process.stdout.write(
        `wrote ${out} (${width}x${height}, ${samples ** 2} samples a pixel) in ${seconds} s\n`,
    );
}

if (isMainThread) await main();
else if (workerData.task === "grid") gridRows(workerData);
else renderRows(workerData);
