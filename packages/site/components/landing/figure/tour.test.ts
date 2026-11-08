import { expect, it } from "vitest";
import { LINES, PERIOD, poseAt, STILL, type Pose } from "./tour";

const SEEN = [
    "coinShown",
    "paid",
    "drawer",
    "inDrawer",
    "hatch",
    "inChamber",
    "screen",
    "lines",
    "elapsed",
    "shutter",
] as const;

const times = (from: number, to: number, step = 0.01) =>
    Array.from({ length: Math.round((to - from) / step) + 1 }, (_, at) => from + at * step);

it("draws a running sandbox in the still pose: every line typed, the dial part way", () => {
    const pose = poseAt(STILL);
    expect(pose.lines).toEqual(LINES.map(({ text }) => text));
    expect(pose.cursor).toBe(LINES.length - 1);
    expect(pose.inChamber && pose.paid).toBe(true);
    expect(pose.elapsed).toBeGreaterThan(0.5);
    expect(pose.elapsed).toBeLessThan(1);
    expect(pose.shutter).toBe(0);
});

it("empties the chamber only behind the shut shutter", () => {
    for (const t of times(14, PERIOD)) {
        const [now, next] = [poseAt(t), poseAt(t + 0.01)];
        const emptied = now.inChamber !== next.inChamber || (now.screen > 0 && next.screen === 0);
        if (emptied) expect(now.shutter).toBe(1);
    }
});

it("runs the dial forward to the deadline, then the shutter comes down", () => {
    const run = times(7.2, 15.2, 0.1).map((t) => poseAt(t).elapsed);
    expect(run.every((elapsed, at) => at === 0 || elapsed >= run[at - 1]!)).toBe(true);
    expect(poseAt(15.2).elapsed).toBe(1);
    expect(poseAt(15.2).shutter).toBe(0);
    expect(poseAt(16.2).shutter).toBe(1);
});

it("loops without a jump: the end of a run is the empty cabinet it starts from", () => {
    const seen = (pose: Pose) => SEEN.map((key) => pose[key]);
    expect(seen(poseAt(PERIOD - 0.001))).toEqual(seen(poseAt(0)));
    expect(poseAt(0)).toMatchObject({ drawer: 0, inDrawer: false, inChamber: false, elapsed: 0 });
});

it("opens one airlock door at a time", () => {
    for (const t of times(0, PERIOD)) {
        const pose = poseAt(t);
        expect(pose.drawer > 0 && pose.hatch > 0).toBe(false);
    }
});
