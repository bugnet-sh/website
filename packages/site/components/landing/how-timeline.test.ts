import { expect, it } from "vitest";
import { HOLD_MS, STEP_MS, timeline } from "./how-timeline";

it("lights each step in turn, then rests with none lit", () => {
    expect(timeline(3)).toEqual([
        { step: 0, ms: STEP_MS },
        { step: 1, ms: STEP_MS },
        { step: 2, ms: STEP_MS },
        { step: -1, ms: HOLD_MS },
    ]);
});
