import {
    circleRing,
    circleSection,
    corners,
    cylinder,
    depthOf,
    extrude,
    frameX,
    frameY,
    frontMatrix,
    hullOf,
    insetPlan,
    onTop,
    pathOf,
    planOutline,
    prismOf,
    ring,
    roundedPlan,
    segment,
    sideArc,
    sideSeam,
    slabOf,
    type Flat,
    type Plan,
    type Plane,
    type Point3,
} from "../../iso/iso-kit";
import {
    ACCEPTOR,
    ACCEPTOR_TOP,
    BAR_Z,
    CAB,
    CAB_TOP,
    CAB_Z,
    CART,
    CAVITY,
    CH_FRONT,
    CH_SIDE,
    CH_TOP,
    CHAMBER,
    COIN,
    CRADLE,
    CRADLE_TOP,
    DIAL,
    DROP,
    FLOOR,
    FRONT,
    HATCH,
    LEDGE,
    OPENING,
    P,
    PLATE,
    PLATE_FOOT,
    PLATE_H,
    POST_W,
    POST_X,
    ROOF_TOP,
    SCREEN,
    SEAT_TOP,
    SHUTTER,
    SIDE,
    SLOT,
    SPAN,
    TERM_FRONT,
    TERM_TOP,
    TERM_Z,
    TERMINAL,
    TRAVEL,
    TRAY,
    WINDOW,
    WORKTOP,
    at,
} from "./view";

const join = (paths: string[]) => paths.filter(Boolean).join("");
const box = (from: Point3, to: Point3, r = 0.6, steps = 2, bevel = 0) =>
    slabOf(
        { x: from[0], y: from[1], w: to[0] - from[0], d: to[1] - from[1], r },
        from[2],
        to[2] - from[2],
        P,
        steps,
        bevel,
    );
const roundY = (x: number, z: number, r: number, y0: number, y1: number, steps = 40) =>
    prismOf(frameY([x, y0, z]), circleSection(r, steps), 0, y1 - y0, P);
const roundX = (y: number, z: number, r: number, x0: number, x1: number, steps = 40) =>
    prismOf(frameX([x0, y, z]), circleSection(r, steps), 0, x1 - x0, P);
const byDepth = (points: Plane[], z = 0) =>
    [...points].sort((a, b) => depthOf([a[0], a[1], z], P) - depthOf([b[0], b[1], z], P));
const dotsAt = (points: Point3[]): Flat[] => points.map(at);

const frontRing = (x0: number, z0: number, x1: number, z1: number, r: number, steps = 4) =>
    roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, steps);
const onFront = (points: Plane[], y: number, closed = true) =>
    pathOf(
        points.map(([x, z]) => at([x, y, z])),
        closed,
    );
const onSide = (points: Plane[], x: number, closed = true) =>
    pathOf(
        points.map(([y, z]) => at([x, y, z])),
        closed,
    );

export interface Recess {
    clip: string;
    tops: string;
    sides: string;
    back: string;
    rim: string;
}

function frontRecess(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    r: number,
    y: number,
    depth: number,
): Recess {
    const outline = frontRing(x0, z0, x1, z1, r);
    const tops: string[] = [];
    const sides: string[] = [];
    outline.forEach(([ax, az], index) => {
        const [bx, bz] = outline[(index + 1) % outline.length]!;
        const length = Math.hypot(bx - ax, bz - az) || 1;
        let nx = (bz - az) / length;
        let nz = -(bx - ax) / length;
        if (nx * ((x0 + x1) / 2 - (ax + bx) / 2) + nz * ((z0 + z1) / 2 - (az + bz) / 2) < 0) {
            nx = -nx;
            nz = -nz;
        }
        if (nx <= 0 && nz <= 0) return;
        const quad = pathOf(
            [at([ax, y, az]), at([bx, y, bz]), at([bx, y - depth, bz]), at([ax, y - depth, az])],
            true,
        );
        (nz >= nx ? tops : sides).push(quad);
    });
    return {
        clip: onFront(outline, y),
        tops: join(tops),
        sides: join(sides),
        back: onFront(outline, y - depth),
        rim: onFront(outline, y),
    };
}

function topRecess(plan: Plan, z: number, depth: number): Recess {
    const outline = roundedPlan(plan, 3);
    const cx = plan.x + plan.w / 2;
    const cy = plan.y + plan.d / 2;
    const tops: string[] = [];
    const sides: string[] = [];
    outline.forEach(([ax, ay], index) => {
        const [bx, by] = outline[(index + 1) % outline.length]!;
        const length = Math.hypot(bx - ax, by - ay) || 1;
        let nx = (by - ay) / length;
        let ny = -(bx - ax) / length;
        if (nx * (cx - (ax + bx) / 2) + ny * (cy - (ay + by) / 2) < 0) {
            nx = -nx;
            ny = -ny;
        }
        if (nx <= 0 && ny <= 0) return;
        const quad = pathOf(
            [at([ax, ay, z]), at([bx, by, z]), at([bx, by, z - depth]), at([ax, ay, z - depth])],
            true,
        );
        (ny >= nx ? tops : sides).push(quad);
    });
    return {
        clip: onTop(outline, z, P, true),
        tops: join(tops),
        sides: join(sides),
        back: onTop(outline, z - depth, P, true),
        rim: onTop(outline, z, P, true),
    };
}

/** The screen area a box covers over its travel, as a fixed clip for a part that slides through an opening. */
function sweep(from: Point3, to: Point3, by: Point3) {
    const points: Flat[] = [];
    for (const shift of [0, 1]) {
        for (const x of [from[0], to[0]]) {
            for (const y of [from[1], to[1]]) {
                for (const z of [from[2], to[2]]) {
                    points.push(at([x + by[0] * shift, y + by[1] * shift, z + by[2] * shift]));
                }
            }
        }
    }
    return pathOf(hullOf(points), true);
}

const LABEL: Plan = { x: PLATE.x + 12, y: PLATE.y + PLATE.d - 22, w: 46, d: 12, r: 1.5 };

export const PLATE_ART = {
    halo: slabOf(PLATE, -PLATE_H - PLATE_FOOT, PLATE_H, P, 6).fill,
    feet: byDepth(corners(PLATE, 22)).map(([x, y]) =>
        cylinder(x, y, 6, -PLATE_H - PLATE_FOOT, PLATE_FOOT, P, 28),
    ),
    slab: slabOf(PLATE, -PLATE_H, PLATE_H, P, 6, 1.4),
    groove: planOutline(insetPlan(PLATE, 5), 0, P, 6),
    screwRings: join(corners(PLATE, 10).map(([x, y]) => ring(x, y, 2.2, 0, P, 16))),
    screws: dotsAt(corners(PLATE, 10).map(([x, y]) => [x, y, 0])),
    label: slabOf(LABEL, 0, 0.8, P, 3),
    labelEdge: planOutline(insetPlan(LABEL, 1.6), 0.8, P, 3),
    labelRule: join(
        [30, 22, 26].map((w, row) =>
            onTop(
                [
                    [LABEL.x + 8, LABEL.y + 3.4 + row * 2.6],
                    [LABEL.x + 8 + w, LABEL.y + 3.4 + row * 2.6],
                ],
                0.8,
                P,
            ),
        ),
    ),
    labelScrews: dotsAt([
        [LABEL.x + 3.6, LABEL.y + LABEL.d / 2, 0.8],
        [LABEL.x + LABEL.w - 3.6, LABEL.y + LABEL.d / 2, 0.8],
    ]),
};

const HEX: Plane[] = Array.from({ length: 6 }, (_, side) => {
    const angle = (side / 6) * Math.PI * 2 + Math.PI / 6;
    return [5.2 * Math.cos(angle), 5.2 * Math.sin(angle)];
});

const SLOTS = (from: number, count: number, gap: number) =>
    Array.from({ length: count }, (_, index) => from + index * gap);

const DIAL_FACE = DIAL.face;
const dialPoint = (angle: number, r: number): Point3 => [
    DIAL.x + r * Math.sin(angle),
    DIAL_FACE,
    DIAL.z + r * Math.cos(angle),
];

function dialTicks() {
    const minor: string[] = [];
    const major: string[] = [];
    for (let step = 0; step <= 20; step++) {
        const angle = -SPAN / 2 + (step / 20) * SPAN;
        const big = step % 2 === 0;
        const line = segment(dialPoint(angle, 20.6), dialPoint(angle, big ? 16.6 : 18.4), P);
        (big ? major : minor).push(line);
    }
    return { minor: join(minor), major: join(major) };
}

const TICKS = dialTicks();
const END = SPAN / 2;
const MOUNT: [Point3, Point3] = [
    [DIAL.x - 28, FRONT, DIAL.z - 28],
    [DIAL.x + 28, FRONT + 1.5, DIAL.z + 28],
];

export const CABINET_ART = {
    halo: slabOf(CAB, 0, CAB_Z, P, 3).fill,
    feet: byDepth(corners(CAB, 14)).map(([x, y]) => ({
        flange: cylinder(x, y, 7, 0, 1.8, P, 28),
        hex: extrude(
            HEX.map(([hx, hy]) => [x + hx, y + hy] as Plane),
            1.8,
            4,
            P,
        ),
        stem: cylinder(x, y, 2.2, 5.8, CAB_Z - 5.8, P, 16),
    })),
    body: slabOf(CAB, CAB_Z, CAB_TOP - CAB_Z, P, 3, 1),
    bodySeams: join([CAB_Z + 6, CAB_TOP - 4].map((z) => sideSeam(CAB, z, P, 3))),
    worktop: slabOf(WORKTOP, CAB_TOP, LEDGE - CAB_TOP, P, 4, 1.2),
    faceScrews: dotsAt([
        [CAB.x + 6, FRONT, CAB_Z + 12],
        [SIDE - 6, FRONT, CAB_Z + 12],
        [CAB.x + 6, FRONT, CAB_TOP - 10],
        [SIDE - 6, FRONT, CAB_TOP - 10],
    ]),
    mount: box(MOUNT[0], MOUNT[1], 1.2, 3),
    mountScrews: dotsAt(
        [
            [-24, -24],
            [24, -24],
            [-24, 24],
            [24, 24],
        ].map(([dx, dz]) => [DIAL.x + dx!, FRONT + 1.5, DIAL.z + dz!] as Point3),
    ),
    bezel: roundY(DIAL.x, DIAL.z, DIAL.r, FRONT + 1.5, DIAL_FACE, 72),
    faceRing: onFront(
        circleRing(DIAL.x, DIAL.z, 20.6, 72).map(([x, z]) => [x, z] as Plane),
        DIAL_FACE,
    ),
    rim: onFront(
        circleRing(DIAL.x, DIAL.z, 22.6, 72).map(([x, z]) => [x, z] as Plane),
        DIAL_FACE,
    ),
    minor: TICKS.minor,
    major: TICKS.major,
    deadline: segment(dialPoint(END, 20.6), dialPoint(END, 12.6), P),
    start: at(dialPoint(-END, 20.6)),
    opening: frontRecess(OPENING.x0, OPENING.z0, OPENING.x1, OPENING.z1, 2, FRONT, 60),
    door: onFront(frontRing(76, 16, 115, 80, 2), FRONT),
    hinges: [22, 64].map((z) => box([74.5, FRONT, z], [77.5, FRONT + 2, z + 9], 0.8)),
    vents: join(SLOTS(83, 6, 4).map((x) => onFront(frontRing(x, 30, x + 2, 66, 1), FRONT))),
    latch: roundY(107, 48, 3.2, FRONT, FRONT + 2.2, 32),
    latchSlot: onFront(
        [
            [107 - 2.2, 48],
            [107 + 2.2, 48],
        ],
        FRONT + 2.2,
        false,
    ),
    sideVents: join(SLOTS(-66, 9, 5).map((y) => onSide(frontRing(y, 40, y + 2, 70, 1), SIDE))),
    sideScrews: dotsAt([
        [SIDE, CAB.y + 8, CAB_Z + 12],
        [SIDE, CAB.y + 8, CAB_TOP - 10],
    ]),
};

export const DIAL_PLANE = {
    matrix: frontMatrix(DIAL_FACE + 0.3, P),
    centre: [DIAL.x, -DIAL.z] as Flat,
    hub: roundY(DIAL.x, DIAL.z, 2.4, DIAL_FACE, DIAL_FACE + 2, 24),
};

const W_RING = frontRing(WINDOW.x0, WINDOW.z0, WINDOW.x1, WINDOW.z1, WINDOW.r, 5);

function cavity() {
    const { x0, x1, y0, z0, z1 } = CAVITY;
    const y1 = CH_FRONT;
    return {
        back: pathOf(
            [at([x0, y0, z0]), at([x1, y0, z0]), at([x1, y0, z1]), at([x0, y0, z1])],
            true,
        ),
        left: pathOf(
            [at([x0, y0, z0]), at([x0, y1, z0]), at([x0, y1, z1]), at([x0, y0, z1])],
            true,
        ),
        floor: pathOf(
            [at([x0, y0, z0]), at([x1, y0, z0]), at([x1, y1, z0]), at([x0, y1, z0])],
            true,
        ),
        grid: SLOTS(-104, 27, 8)
            .flatMap((x) => SLOTS(-64, 12, 8).map((y) => at([x, y, z0])))
            .map(([x, y]) => `M${x.toFixed(1)} ${y.toFixed(1)}h0`)
            .join(""),
    };
}

const SCREEN_RECESS = frontRecess(
    SCREEN.x0,
    SCREEN.z0,
    SCREEN.x1,
    SCREEN.z1,
    SCREEN.r,
    TERM_FRONT,
    SCREEN.depth,
);

const DRAIN = { x: 74, y: 12, r: 10 };

function drainBars() {
    const bars: string[] = [];
    const inner = DRAIN.r - 2.4;
    for (let offset = -inner + 1.6; offset < inner - 1; offset += 2.2) {
        const half = Math.sqrt(inner * inner - offset * offset);
        bars.push(
            onTop(
                [
                    [DRAIN.x - half, DRAIN.y + offset],
                    [DRAIN.x + half, DRAIN.y + offset],
                ],
                FLOOR + 0.8,
                P,
            ),
        );
    }
    return join(bars);
}

export const DRAIN_ART = {
    plate: cylinder(DRAIN.x, DRAIN.y, DRAIN.r, FLOOR, 0.8, P, 40),
    grate: ring(DRAIN.x, DRAIN.y, DRAIN.r - 2.4, FLOOR + 0.8, P, 48),
    bars: drainBars(),
    screws: dotsAt(
        [0, 1, 2, 3].map((quarter) => {
            const angle = (quarter / 4) * Math.PI * 2 + Math.PI / 4;
            return [
                DRAIN.x + (DRAIN.r - 1.2) * Math.cos(angle),
                DRAIN.y + (DRAIN.r - 1.2) * Math.sin(angle),
                FLOOR + 0.8,
            ] as Point3;
        }),
    ),
};

export const TERMINAL_ART = {
    plinth: slabOf(insetPlan(TERMINAL, 5), FLOOR, TERM_Z - FLOOR, P, 3),
    body: slabOf(TERMINAL, TERM_Z, TERM_TOP - TERM_Z, P, 3, 1),
    band: sideSeam(TERMINAL, TERM_Z + 5, P, 3),
    screen: SCREEN_RECESS,
    bezel: onFront(
        frontRing(SCREEN.x0 - 3, SCREEN.z0 - 3, SCREEN.x1 + 3, SCREEN.z1 + 3, SCREEN.r + 2),
        TERM_FRONT,
    ),
    leds: dotsAt([
        [SCREEN.x0 + 2, TERM_FRONT, 101.5],
        [SCREEN.x0 + 7, TERM_FRONT, 101.5],
    ]),
    knob: roundY(SCREEN.x1 - 2, 101.5, 2.6, TERM_FRONT, TERM_FRONT + 2.4, 24),
    knobRing: onFront(circleRing(SCREEN.x1 - 2, 101.5, 1.2, 16) as Plane[], TERM_FRONT + 2.4),
    vents: join(
        SLOTS(TERMINAL.x + 12, 9, 6).map((x) =>
            planOutline({ x, y: TERMINAL.y + 10, w: 2.4, d: 26, r: 1.2 }, TERM_TOP, P, 3),
        ),
    ),
    sideVents: join(
        SLOTS(TERMINAL.y + 8, 5, 5).map((y) =>
            onSide(frontRing(y, 128, y + 2, 150, 1), TERMINAL.x + TERMINAL.w),
        ),
    ),
    plug: box([TERMINAL.x + TERMINAL.w, -2, 99], [TERMINAL.x + TERMINAL.w + 3, 6, 105], 0.6),
    matrix: frontMatrix(TERM_FRONT - SCREEN.depth, P),
};

const curve = (from: Point3, sag: Point3, to: Point3) =>
    pathOf(
        Array.from({ length: 17 }, (_, step) => {
            const t = step / 16;
            const blend = (axis: 0 | 1 | 2) =>
                (1 - t) * (1 - t) * from[axis] + 2 * (1 - t) * t * sag[axis] + t * t * to[axis];
            return at([blend(0), blend(1), blend(2)]);
        }),
    );

const [LEFT_POST, RIGHT_POST] = POST_X.map((x) =>
    box([x, HATCH.y0 + 1, CRADLE_TOP], [x + POST_W, HATCH.y1 - 1, BAR_Z], 0.6, 2, 0.4),
) as [ReturnType<typeof box>, ReturnType<typeof box>];

const HATCH_PLAN: Plan = {
    x: HATCH.x0,
    y: HATCH.y0,
    w: HATCH.x1 - HATCH.x0,
    d: HATCH.y1 - HATCH.y0,
    r: 1,
};
const HALF = (HATCH.y1 - HATCH.y0) / 2;

export const CRADLE_ART = {
    base: slabOf(CRADLE, FLOOR, CRADLE_TOP - FLOOR, P, 3, 0.5),
    hole: topRecess(HATCH_PLAN, CRADLE_TOP, 6),
    holeScrews: dotsAt([
        [CRADLE.x + 3, CRADLE.y + 3, CRADLE_TOP],
        [CRADLE.x + CRADLE.w - 3, CRADLE.y + 3, CRADLE_TOP],
        [CRADLE.x + 3, CRADLE.y + CRADLE.d - 3, CRADLE_TOP],
        [CRADLE.x + CRADLE.w - 3, CRADLE.y + CRADLE.d - 3, CRADLE_TOP],
    ]),
    covers: [0, 1].map((half) =>
        box(
            [HATCH.x0, HATCH.y0 + half * HALF, CRADLE_TOP],
            [HATCH.x1, HATCH.y0 + (half + 1) * HALF, CRADLE_TOP + 1],
            0.4,
        ),
    ),
    coverTravel: HALF,
    leftPost: LEFT_POST,
    rightPost: RIGHT_POST,
    bar: box(
        [POST_X[0]!, HATCH.y0 + 1, BAR_Z],
        [POST_X[1]! + POST_W, HATCH.y1 - 1, BAR_Z + 5],
        0.8,
        2,
        0.5,
    ),
    barScrews: dotsAt([
        [POST_X[0]! + POST_W / 2, (HATCH.y0 + HATCH.y1) / 2, BAR_Z + 5],
        [POST_X[1]! + POST_W / 2, (HATCH.y0 + HATCH.y1) / 2, BAR_Z + 5],
    ]),
    pad: box([24, 15.5, CART.z0 + CART.h + 1], [36, 22.5, BAR_Z], 0.4),
    led: at([POST_X[1]! + POST_W / 2, HATCH.y1 - 1, BAR_Z - 4]),
    plugCradle: box([CRADLE.x - 3, 16, FLOOR], [CRADLE.x, 22, FLOOR + 4], 0.5),
    cable: curve(
        [CRADLE.x - 3, 19, FLOOR + 2],
        [-8, 8, FLOOR - 2],
        [TERMINAL.x + TERMINAL.w + 3, 2, 102],
    ),
    lift: sweep([CART.x0, CART.y0, FLOOR], [CART.x1, CART.y1, FLOOR], [0, 0, 80]),
};

function cartridge(z0: number) {
    const { x0, x1, y0, y1, h } = CART;
    const top = z0 + h;
    return {
        body: box([x0, y0, z0], [x1, y1, top], 1.2, 2, 0.5),
        grip: join(
            [top - 6, top - 4.2, top - 2.4].map((z) =>
                sideSeam({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 1.2 }, z, P, 2),
            ),
        ),
        label: onFront(frontRing(x0 + 3, z0 + 5, x1 - 3, z0 + 21, 1), y1),
        rule: join(
            [16, 11, 13].map((w, row) =>
                onFront(
                    [
                        [x0 + 6, z0 + 17 - row * 3.4],
                        [x0 + 6 + w, z0 + 17 - row * 3.4],
                    ],
                    y1,
                    false,
                ),
            ),
        ),
        notch: box([x0 + 4, y0 + 1.5, top], [x1 - 4, y1 - 1.5, top + 1.6], 0.5),
    };
}

export const CART_ART = { seated: cartridge(CART.z0), inDrawer: cartridge(SEAT_TOP) };

const GLASS_STREAKS = join([
    onFront(
        [
            [-40, WINDOW.z0],
            [30, WINDOW.z1],
        ],
        CH_FRONT,
        false,
    ),
    onFront(
        [
            [-22, WINDOW.z0],
            [48, WINDOW.z1],
        ],
        CH_FRONT,
        false,
    ),
]);

const BOLTS: Point3[] = [
    ...SLOTS(102, 9, 12.5).flatMap((z) => [
        [CHAMBER.x + 3.6, CH_FRONT, z] as Point3,
        [CH_SIDE - 3.6, CH_FRONT, z] as Point3,
    ]),
    ...SLOTS(-96, 17, 12).map((x) => [x, CH_FRONT, 95] as Point3),
];

const SLATS = SLOTS(SHUTTER.z0 + 6, 17, 6);

export const CHAMBER_ART = {
    shell: slabOf(CHAMBER, LEDGE, CH_TOP - LEDGE, P, 3, 1),
    shellSeam: sideSeam(CHAMBER, LEDGE + 4, P, 3),
    roof: slabOf(insetPlan(CHAMBER, -2.5), CH_TOP, ROOF_TOP - CH_TOP, P, 4, 1),
    window: onFront(W_RING, CH_FRONT),
    cavity: cavity(),
    glass: onFront(W_RING, CH_FRONT - 1),
    streaks: GLASS_STREAKS,
    bolts: dotsAt(BOLTS),
    guides: [-1, 1].map((side) =>
        box(
            [side < 0 ? -107 : 102, CH_FRONT, LEDGE + 6],
            [side < 0 ? -102 : 107, CH_FRONT + 6, SHUTTER.z1],
            0.5,
            2,
            0.4,
        ),
    ),
    housing: box([-108, CH_FRONT, SHUTTER.z1], [108, CH_FRONT + 8, CH_TOP - 1], 1, 3, 0.6),
    housingSeam: sideSeam({ x: -108, y: CH_FRONT, w: 216, d: 8, r: 1 }, SHUTTER.z1 + 3, P, 3),
    housingScrews: dotsAt([
        [-100, CH_FRONT + 8, SHUTTER.z1 + 6.5],
        [100, CH_FRONT + 8, SHUTTER.z1 + 6.5],
    ]),
    /** The shutter's curtain, drawn flat in its plane, shut; it rises out of view to open. */
    shutter: {
        matrix: frontMatrix(SHUTTER.y, P),
        clip: `M${SHUTTER.x0} ${-SHUTTER.z1}H${SHUTTER.x1}V${-SHUTTER.z0}H${SHUTTER.x0}Z`,
        sheet: `M${SHUTTER.x0} ${-SHUTTER.z1}H${SHUTTER.x1}V${-SHUTTER.z0}H${SHUTTER.x0}Z`,
        slats: SLATS.map((z) => `M${SHUTTER.x0} ${-z}H${SHUTTER.x1}`).join(""),
        foot: `M${SHUTTER.x0} ${-(SHUTTER.z0 + 4)}H${SHUTTER.x1}V${-SHUTTER.z0}H${SHUTTER.x0}Z`,
        travel: SHUTTER.z1 - SHUTTER.z0,
    },
    windowClip: onFront(W_RING, CH_FRONT),
};

const PORT = { y: -20, z: 152 };
const DUCT = { y: -52, z: 118 };
const HEPA: Plan = { x: -70, y: -58, w: 90, d: 70, r: 2 };
const HEPA_TOP = ROOF_TOP + 18;
const STACK = { x: -25, y: -23, r: 15 };

function boltCircle(cy: number, cz: number, r: number, x: number, count: number) {
    return dotsAt(
        Array.from({ length: count }, (_, index) => {
            const angle = (index / count) * Math.PI * 2;
            return [x, cy + r * Math.cos(angle), cz + r * Math.sin(angle)] as Point3;
        }),
    );
}

export const SIDE_ART = {
    panel: onSide(frontRing(CHAMBER.y + 8, LEDGE + 8, CH_FRONT - 8, CH_TOP - 8, 4), CH_SIDE),
    port: roundX(PORT.y, PORT.z, 18, CH_SIDE, CH_SIDE + 4, 48),
    portBolts: boltCircle(PORT.y, PORT.z, 16, CH_SIDE + 4, 10),
    cap: roundX(PORT.y, PORT.z, 13, CH_SIDE + 4, CH_SIDE + 7, 40),
    capRing: onSide(
        circleRing(PORT.y, PORT.z, 9, 40).map(([y, z]) => [y, z] as Plane),
        CH_SIDE + 7,
    ),
    flange: roundX(DUCT.y, DUCT.z, 10, CH_SIDE, CH_SIDE + 3, 48),
    flangeBolts: boltCircle(DUCT.y, DUCT.z, 8.4, CH_SIDE + 3, 6),
    duct: roundX(DUCT.y, DUCT.z, 6, CH_SIDE + 3, CH_SIDE + 900, 40),
    bands: [44, 110].map((x) => roundX(DUCT.y, DUCT.z, 6.8, CH_SIDE + x, CH_SIDE + x + 3, 40)),
};

export const ROOF_ART = {
    hepa: slabOf(HEPA, ROOF_TOP, HEPA_TOP - ROOF_TOP, P, 3, 0.8),
    hepaSeam: sideSeam(HEPA, ROOF_TOP + 5, P, 3),
    hepaFrame: planOutline(insetPlan(HEPA, 4), HEPA_TOP, P, 3),
    pleats: join(
        SLOTS(HEPA.x + 8, 20, 4).map((x) =>
            onTop(
                [
                    [x, HEPA.y + 4],
                    [x, HEPA.y + HEPA.d - 4],
                ],
                HEPA_TOP,
                P,
            ),
        ),
    ),
    collar: cylinder(STACK.x, STACK.y, STACK.r + 4, HEPA_TOP, 4, P, 48),
    stack: cylinder(STACK.x, STACK.y, STACK.r, HEPA_TOP + 4, 26, P, 48),
    band: cylinder(STACK.x, STACK.y, STACK.r + 1, HEPA_TOP + 30, 4, P, 48),
    stackUp: cylinder(STACK.x, STACK.y, STACK.r, HEPA_TOP + 34, 900, P, 48),
    stackSeam: sideArc(STACK.x, STACK.y, STACK.r, HEPA_TOP + 64, P, 32),
    lampBase: cylinder(72, -24, 7, ROOF_TOP, 4, P, 32),
    lamp: cylinder(72, -24, 5, ROOF_TOP + 4, 8, P, 32),
    lampRing: sideArc(72, -24, 5, ROOF_TOP + 8, P, 24),
};

const LAMP_PLATE: Plan = { x: 6, y: 56, w: 48, d: 12, r: 1.5 };

const RULER: Plan = { x: 64, y: 62, w: 52, d: 6, r: 0.8 };

function rulerTicks() {
    const minor: string[] = [];
    const major: string[] = [];
    for (let x = RULER.x + 4, index = 0; x <= RULER.x + RULER.w - 4; x += 4, index++) {
        const big = index % 5 === 0;
        const line = onTop(
            [
                [x, RULER.y + 0.4],
                [x, RULER.y + (big ? 3.6 : 2)],
            ],
            LEDGE + 0.6,
            P,
        );
        (big ? major : minor).push(line);
    }
    return { minor: join(minor), major: join(major) };
}

export const LEDGE_ART = {
    ruler: slabOf(RULER, LEDGE, 0.6, P, 2),
    rulerEdge: onTop(
        [
            [RULER.x + 0.4, RULER.y + 0.4],
            [RULER.x + RULER.w - 0.4, RULER.y + 0.4],
        ],
        LEDGE + 0.6,
        P,
    ),
    rulerTicks: rulerTicks(),
    lampPlate: slabOf(LAMP_PLATE, LEDGE, 1, P, 3),
    lampScrews: dotsAt([
        [LAMP_PLATE.x + 3.5, LAMP_PLATE.y + LAMP_PLATE.d / 2, LEDGE + 1],
        [LAMP_PLATE.x + LAMP_PLATE.w - 3.5, LAMP_PLATE.y + LAMP_PLATE.d / 2, LEDGE + 1],
    ]),
    lamps: [18, 42].map((x) => ({
        base: cylinder(x, 62, 4, LEDGE + 1, 2, P, 28),
        lens: cylinder(x, 62, 3, LEDGE + 3, 3, P, 28),
    })),
    acceptor: slabOf(ACCEPTOR, LEDGE, ACCEPTOR_TOP - LEDGE, P, 3, 0.8),
    acceptorSeam: sideSeam(ACCEPTOR, LEDGE + 4, P, 3),
    bezel: slabOf(insetPlan(ACCEPTOR, 2.5), ACCEPTOR_TOP, 2, P, 3, 0.5),
    slot: topRecess(
        { x: SLOT.x0, y: SLOT.y0, w: SLOT.x1 - SLOT.x0, d: SLOT.y1 - SLOT.y0, r: 1.2 },
        ACCEPTOR_TOP + 2,
        4,
    ),
    returnButton: roundY(-99, 99, 3, ACCEPTOR.y + ACCEPTOR.d, ACCEPTOR.y + ACCEPTOR.d + 2.4, 28),
    paidLamp: roundY(-83, 100, 2.2, ACCEPTOR.y + ACCEPTOR.d, ACCEPTOR.y + ACCEPTOR.d + 1.4, 24),
    frontScrews: dotsAt([
        [ACCEPTOR.x + 3.5, ACCEPTOR.y + ACCEPTOR.d, ACCEPTOR_TOP - 4],
        [ACCEPTOR.x + ACCEPTOR.w - 3.5, ACCEPTOR.y + ACCEPTOR.d, ACCEPTOR_TOP - 4],
    ]),
    sideScrews: dotsAt([
        [ACCEPTOR.x + ACCEPTOR.w, ACCEPTOR.y + 5, LEDGE + 9],
        [ACCEPTOR.x + ACCEPTOR.w, ACCEPTOR.y + ACCEPTOR.d - 5, LEDGE + 9],
    ]),
    /** Where the coin can be seen: above the slot, and down into it. */
    coinClip: sweep(
        [SLOT.x0, SLOT.y0, ACCEPTOR_TOP + 2],
        [SLOT.x1, SLOT.y1, ACCEPTOR_TOP + 2],
        [0, 0, 200],
    ),
};

/** A USDC coin falling edge first into the slot, built at the top of its fall. */
function coin() {
    const face = COIN.y + COIN.t / 2;
    const mark = (from: number, to: number, r: number) =>
        onFront(
            Array.from({ length: 13 }, (_, step) => {
                const angle = from + ((to - from) * step) / 12;
                return [COIN.x + r * Math.sin(angle), COIN.top + r * Math.cos(angle)] as Plane;
            }),
            face,
            false,
        );
    return {
        body: roundY(COIN.x, COIN.top, COIN.r, COIN.y - COIN.t / 2, face, 48),
        rim: onFront(
            circleRing(COIN.x, COIN.top, COIN.r - 1.2, 40).map(([x, z]) => [x, z] as Plane),
            face,
        ),
        mark: join([
            mark(-2.5, -0.65, 4.8),
            mark(0.65, 2.5, 4.8),
            onFront(
                [
                    [COIN.x, COIN.top - 3.6],
                    [COIN.x, COIN.top + 3.6],
                ],
                face,
                false,
            ),
        ]),
        fall: COIN.top - COIN.bottom,
    };
}

export const COIN_ART = coin();

export const DRAWER_ART = {
    floor: box([TRAY.x0, TRAY.y0, TRAY.z0], [TRAY.x1, FRONT, TRAY.z0 + 2], 0.5),
    back: box([TRAY.x0 + 2, TRAY.y0, TRAY.z0 + 2], [TRAY.x1 - 2, TRAY.y0 + 2, TRAY.wall], 0.4),
    left: box([TRAY.x0, TRAY.y0, TRAY.z0 + 2], [TRAY.x0 + 2, FRONT, TRAY.wall], 0.4),
    right: box([TRAY.x1 - 2, TRAY.y0, TRAY.z0 + 2], [TRAY.x1, FRONT, TRAY.wall], 0.4),
    seat: box([14, 13, TRAY.z0 + 2], [46, 25, SEAT_TOP], 0.6, 2, 0.4),
    panel: box(
        [OPENING.x0 - 3, FRONT, OPENING.z0 - 3],
        [OPENING.x1 + 3, FRONT + 3.5, OPENING.z1 + 3],
        1.2,
        3,
        0.8,
    ),
    gasket: onFront(
        frontRing(OPENING.x0 + 1, OPENING.z0 + 1, OPENING.x1 - 1, OPENING.z1 - 1, 2),
        FRONT + 3.5,
    ),
    posts: [17, 41].map((x) =>
        box([x, FRONT + 3.5, OPENING.z1 - 12], [x + 4, FRONT + 8, OPENING.z1 - 8], 0.6),
    ),
    pull: box([14, FRONT + 8, OPENING.z1 - 12.5], [48, FRONT + 10.5, OPENING.z1 - 7.5], 1, 2, 0.4),
    holder: box([18, FRONT + 3.5, OPENING.z0 + 6], [42, FRONT + 4.5, OPENING.z0 + 18], 0.6),
    holderEdge: onFront(
        frontRing(19.6, OPENING.z0 + 7.6, 40.4, OPENING.z0 + 16.4, 0.6),
        FRONT + 4.5,
    ),
    holderRule: join(
        [14, 10].map((w, row) =>
            onFront(
                [
                    [22, OPENING.z0 + 13.6 - row * 3],
                    [22 + w, OPENING.z0 + 13.6 - row * 3],
                ],
                FRONT + 4.5,
                false,
            ),
        ),
    ),
    panelScrews: dotsAt([
        [OPENING.x0, FRONT + 3.5, OPENING.z0],
        [OPENING.x1, FRONT + 3.5, OPENING.z0],
        [OPENING.x0, FRONT + 3.5, OPENING.z1],
        [OPENING.x1, FRONT + 3.5, OPENING.z1],
    ]),
    /** What the drawer shows: the opening and the space in front of it. */
    clip: sweep(
        [OPENING.x0, FRONT, OPENING.z0],
        [OPENING.x1, FRONT, OPENING.z1],
        [0, TRAVEL + 12, 0],
    ),
    /** Once the drawer is out, the air above it too, for the cartridge dropped into it. */
    clipOpen: sweep(
        [OPENING.x0, FRONT, OPENING.z0],
        [OPENING.x1, FRONT, SEAT_TOP + CART.h + DROP + 4],
        [0, TRAVEL + 12, 0],
    ),
};
