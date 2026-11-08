import type { Pose } from "./tour";

/** The numbers the moving parts need, measured once on the server from the drawing. */
export interface Rig {
    ex: [number, number];
    ey: [number, number];
    ez: [number, number];
    travel: number;
    drop: number;
    lift: number;
    hatch: number;
    fall: number;
    shutter: number;
    dial: { x: number; y: number; r: number; from: number; span: number };
}

/** An attribute's value, or null to remove it. */
export type Attributes = Record<string, string | null>;

const fine = (value: number) => (Math.round(value * 100) / 100).toString();
const move = ([x, y]: [number, number], by: number) =>
    by ? `translate(${fine(x * by)} ${fine(y * by)})` : null;
const flag = (on: boolean) => (on ? "" : null);
const shown = (on: boolean) => (on ? null : "none");

function remaining(rig: Rig, elapsed: number) {
    const { x, y, r, from, span } = rig.dial;
    const start = from + span * elapsed;
    const end = from + span;
    if (end - start < 0.01) return "";
    const point = (angle: number) =>
        `${fine(x + r * Math.sin(angle))} ${fine(y - r * Math.cos(angle))}`;
    const large = end - start > Math.PI ? 1 : 0;
    return `M${point(start)}A${r} ${r} 0 ${large} 1 ${point(end)}`;
}

export function partsOf(pose: Pose, rig: Rig): Record<string, Attributes> {
    const openFully = pose.drawer > 0.999;
    const needle = ((rig.dial.from + rig.dial.span * pose.elapsed) * 180) / Math.PI;
    return {
        coin: {
            transform: move(rig.ez, -rig.fall * pose.coin),
            display: shown(pose.coinShown),
            opacity: pose.coin < 0.04 ? fine(pose.coin / 0.04) : null,
        },
        paid: { "data-on": flag(pose.paid) },
        drawer: { transform: move(rig.ey, rig.travel * pose.drawer) },
        "drawer-window": { "clip-path": openFully ? "url(#sbx-drawer-open)" : "url(#sbx-drawer)" },
        "drawer-cart": {
            transform: move(rig.ez, rig.drop * pose.drop),
            display: shown(pose.inDrawer),
            opacity: pose.dropShown < 1 ? fine(pose.dropShown) : null,
        },
        "outer-lamp": { "data-on": flag(pose.drawer > 0) },
        "inner-lamp": { "data-on": flag(pose.hatch > 0) },
        "hatch-back": { transform: move(rig.ey, -rig.hatch * pose.hatch) },
        "hatch-front": { transform: move(rig.ey, rig.hatch * pose.hatch) },
        lift: {
            transform: move(rig.ez, -rig.lift * (1 - pose.lift)),
            display: shown(pose.inChamber),
        },
        seated: { "data-on": flag(pose.inChamber && pose.lift === 1) },
        power: { "data-on": flag(pose.screen > 0) },
        screen: { "data-on": flag(pose.screen > 0), opacity: fine(pose.screen) },
        needle: { transform: `rotate(${fine(needle)} ${fine(rig.dial.x)} ${fine(rig.dial.y)})` },
        remaining: { d: remaining(rig, pose.elapsed) },
        shutter: {
            transform: move([0, 1], -rig.shutter * (1 - pose.shutter)),
            display: shown(pose.shutter > 0),
        },
    };
}
