import { describe, expect, it } from "vitest";
import { HOLD_MS, LINE_MS, PAUSE_MS, timeline } from "./how-timeline";

describe("timeline", () => {
    it("plays each step's lines in turn, then holds every line, then clears", () => {
        expect(timeline([2, 1])).toEqual([
            { step: 0, shown: [1, 0], ms: LINE_MS, bar: LINE_MS + PAUSE_MS },
            { step: 0, shown: [2, 0], ms: PAUSE_MS },
            { step: 1, shown: [2, 1], ms: PAUSE_MS, bar: PAUSE_MS },
            { step: -1, shown: [2, 1], ms: HOLD_MS },
            { step: -1, shown: [0, 0], ms: LINE_MS },
        ]);
    });

    it("gives each step's bar the length of that step's moments", () => {
        const frames = timeline([6, 6, 5, 5]);
        for (let step = 0; step < 4; step++) {
            const own = frames.filter((f) => f.step === step);
            expect(own[0]?.bar).toBe(own.reduce((sum, f) => sum + f.ms, 0));
        }
    });
});
