// One run of the sandbox cabinet, as a pure function of time. The server draws STILL, reduced
// motion keeps it, and the live figure plays the loop from there.

export const PERIOD = 19;
export const STILL = 12.8;

/** The ten minutes a sandbox runs, played in RUN_FOR seconds. */
const RUN_FROM = 7.2;
const RUN_FOR = 8;
const CHAR = 0.06;

export const LINES = [
    { at: 7.4, text: "$ git clone acme/api", typed: true },
    { at: 9, text: "$ pip install -e .", typed: true },
    { at: 10.6, text: "$ pytest -q", typed: true },
    { at: 12.2, text: "12 passed in 3.41s", typed: false },
    { at: 12.4, text: "$ ", typed: false },
] as const;

export interface Pose {
    /** The coin's fall into the slot, 0 above it to 1 inside; hidden when false. */
    coin: number;
    coinShown: boolean;
    paid: boolean;
    /** The airlock drawer, 0 shut to 1 open. */
    drawer: number;
    /** The cartridge's height above its seat in the drawer, 1 where it starts to fall. */
    drop: number;
    dropShown: number;
    inDrawer: boolean;
    /** The floor hatch, 0 shut to 1 open. */
    hatch: number;
    /** The lift, 0 at the drawer to 1 seated in the cradle. */
    lift: number;
    inChamber: boolean;
    screen: number;
    lines: string[];
    cursor: number;
    /** Share of the ten minutes gone. */
    elapsed: number;
    /** The shutter, 0 open to 1 shut. */
    shutter: number;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const phase = (t: number, from: number, to: number) => clamp((t - from) / (to - from));
const calm = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
const settle = (u: number) => 1 - (1 - u) ** 3;

export function poseAt(time: number): Pose {
    const t = ((time % PERIOD) + PERIOD) % PERIOD;
    const on = t >= RUN_FROM && t < 16.4;
    const fall = phase(t, 0.8, 2);
    const drop = phase(t, 3.4, 4.1);
    const lines = LINES.map(({ at, text, typed }) => {
        if (!on || t < at) return "";
        return typed ? text.slice(0, Math.floor((t - at) / CHAR)) : text;
    });
    let elapsed = 0;
    if (t >= RUN_FROM && t < 16.4) elapsed = phase(t, RUN_FROM, RUN_FROM + RUN_FOR);
    else if (t >= 16.4) elapsed = 1 - calm(phase(t, 16.4, 17.2));
    return {
        coin: fall * fall,
        coinShown: t >= 0.8 && t < 2,
        paid: t >= 2 && t < 16.4,
        drawer: calm(phase(t, 2.3, 3.2)) - calm(phase(t, 4.5, 5.4)),
        drop: 1 - drop * drop,
        dropShown: phase(t, 3.4, 3.6),
        inDrawer: t >= 3.4 && t < 6,
        hatch: calm(phase(t, 5.6, 6)) - calm(phase(t, 16.5, 16.9)),
        lift: settle(phase(t, 6, 7)),
        inChamber: t >= 6 && t < 16.4,
        screen: on ? phase(t, RUN_FROM, RUN_FROM + 0.3) : 0,
        lines,
        cursor: on ? LINES.findLastIndex(({ at }) => t >= at) : -1,
        elapsed,
        shutter: calm(phase(t, 15.4, 16.2)) - calm(phase(t, 17.2, 18)),
    };
}
