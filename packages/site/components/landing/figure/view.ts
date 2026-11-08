import {
    axisVector,
    boxCorners,
    fitProjection,
    iso,
    type Plan,
    type Point3,
} from "../../iso/iso-kit";

// The cabinet's world, in units of about a pixel: x along its front, y toward the viewer, z up

export const WIDTH = 620;
export const HEIGHT = 600;
export const AZIMUTH = 58;
export const ELEVATION = 30;

export const PLATE: Plan = { x: -150, y: -104, w: 300, d: 206, r: 8 };
export const PLATE_H = 7;
export const PLATE_FOOT = 4;

export const CAB: Plan = { x: -120, y: -80, w: 240, d: 152, r: 2 };
export const CAB_Z = 12;
export const CAB_TOP = 86;
export const FRONT = CAB.y + CAB.d;
export const SIDE = CAB.x + CAB.w;
export const WORKTOP: Plan = { x: -123, y: -83, w: 246, d: 158, r: 3 };
export const LEDGE = 91;

export const CHAMBER: Plan = { x: -114, y: -74, w: 228, d: 108, r: 3 };
export const CH_FRONT = CHAMBER.y + CHAMBER.d;
export const CH_SIDE = CHAMBER.x + CHAMBER.w;
export const CH_TOP = 215;
export const ROOF_TOP = 220;
export const WINDOW = { x0: -102, x1: 102, z0: 99, z1: 203, r: 5 };
export const CAVITY = { x0: -111, x1: 111, y0: -71, z0: 93, z1: 212 };
export const FLOOR = CAVITY.z0;

export const TERMINAL: Plan = { x: -100, y: -40, w: 80, d: 48, r: 3 };
export const TERM_Z = 97;
export const TERM_TOP = 158;
export const TERM_FRONT = TERMINAL.y + TERMINAL.d;
export const SCREEN = { x0: -92, x1: -28, z0: 106, z1: 152, r: 3, depth: 2.5 };

export const CRADLE: Plan = { x: 6, y: 4, w: 48, d: 30, r: 2 };
export const CRADLE_TOP = FLOOR + 2;
export const HATCH = { x0: 14, x1: 46, y0: 12, y1: 26 };
export const POST_X = [9, 46];
export const POST_W = 5;
export const BAR_Z = 133;

/** The cartridge where it sits in the cradle; the drawer and the lift move copies of it. */
export const CART = { x0: 16, x1: 44, y0: 14.5, y1: 23.5, z0: CRADLE_TOP, h: 32 };

export const OPENING = { x0: -6, x1: 66, z0: 22, z1: 72 };
export const TRAY = { x0: -4, x1: 64, y0: 8, z0: 23, wall: 46 };
export const SEAT_TOP = 29;
export const TRAVEL = 66;
export const DROP = 70;
export const LIFT = CART.z0 - SEAT_TOP;

export const DIAL = { x: -72, z: 50, r: 24, face: FRONT + 6 };
export const SPAN = (270 * Math.PI) / 180;

export const ACCEPTOR: Plan = { x: -108, y: 42, w: 34, d: 24, r: 2 };
export const ACCEPTOR_TOP = 109;
export const SLOT = { x0: -103, x1: -79, y0: 52.5, y1: 55.5 };
export const COIN = { x: -91, y: 54, r: 10.5, t: 2.4, top: 192, bottom: 97 };

export const SHUTTER = { y: CH_FRONT + 3, x0: -105, x1: 105, z0: WINDOW.z0 - 4, z1: 204 };

const corners = (plan: Plan, z0: number, z1: number) => boxCorners(plan, z0, z1);

export const P = fitProjection(
    [
        ...corners(PLATE, -PLATE_H - PLATE_FOOT, 0),
        ...corners(CHAMBER, ROOF_TOP, 250),
        [CH_SIDE + 70, -50, 120],
    ],
    WIDTH,
    HEIGHT,
    { pad: 0, azimuth: AZIMUTH, elevation: ELEVATION },
);

export const at = (point: Point3) => iso(point, P);
export const EX = axisVector(P, [1, 0, 0]);
export const EY = axisVector(P, [0, 1, 0]);
export const EZ = axisVector(P, [0, 0, 1]);
