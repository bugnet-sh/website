import { iso, pathOf, type Flat, type Point3, type Projection } from "../../iso/iso-kit";

/** Every drawing's box in SVG units; it draws --art-w wide, so at 1 px a unit */
export const ART_W = 280;
export const ART_H = 184;

/** The kit's camera at one unit a scale step, its origin where the drawing wants it */
export const camera = (x: number, y: number): Projection => ({ origin: [x, y], scale: 1 });

export interface BoxPaths {
    top: string;
    left: string;
    right: string;
    /** The edges the viewer sees */
    edges: string;
    /** The three edges behind, for a box seen as glass */
    hidden: string;
    /** Corners on screen: the top face's left, back, right and front, and the front foot */
    corners: { left: Flat; back: Flat; right: Flat; front: Flat; foot: Flat };
}

/**
 * A box from its back corner (x, y, z) and its size. The kit's camera looks with x running right
 * and down, y left and down and z up, so the faces at x + w and y + d face the viewer.
 */
export function box(p: Projection, [x, y, z]: Point3, [w, d, h]: Point3): BoxPaths {
    const at = (a: number, b: number, c: number) => iso([x + a, y + b, z + c], p);
    const [b000, b100, b010, b110] = [at(0, 0, 0), at(w, 0, 0), at(0, d, 0), at(w, d, 0)];
    const [t000, t100, t010, t110] = [at(0, 0, h), at(w, 0, h), at(0, d, h), at(w, d, h)];
    return {
        top: pathOf([t000, t100, t110, t010], true),
        right: pathOf([b100, b110, t110, t100], true),
        left: pathOf([b010, b110, t110, t010], true),
        edges: [
            pathOf([t000, t100, t110, t010], true),
            pathOf([t100, b100, b110, b010, t010]),
            pathOf([t110, b110]),
        ].join(""),
        hidden: [pathOf([b000, b100]), pathOf([b000, b010]), pathOf([b000, t000])].join(""),
        corners: { left: t010, back: t000, right: t100, front: t110, foot: b110 },
    };
}

/** A flat quad on the ground or any level z, from its back corner and its size */
export function plate(p: Projection, [x, y, z]: Point3, [w, d]: [number, number]) {
    return pathOf(
        [
            iso([x, y, z], p),
            iso([x + w, y, z], p),
            iso([x + w, y + d, z], p),
            iso([x, y + d, z], p),
        ],
        true,
    );
}

/** A small seeded random, so a scatter is the same on every render and the server and client agree */
export function seeded(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 2 ** 32;
    };
}

/** One decimal place, for coordinates written by hand into SVG */
export const round = (value: number) => Math.round(value * 10) / 10;
