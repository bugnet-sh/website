import { describe, expect, it } from "vitest";
import {
    CHAR_MS,
    DONE_MS,
    LINE_MS,
    PAUSE_MS,
    REST_MS,
    START_MS,
    timeline,
    typed,
    typing,
    type Line,
} from "./how-timeline";

const type = (chars: number, lead: number): Line => ({ kind: "type", chars, lead });
const more = (chars: number, lead: number): Line => ({ kind: "more", chars, lead });
const print = (chars: number): Line => ({ kind: "print", chars, lead: 0 });
const blank = print(0);

describe("typing", () => {
    it("starts empty, shows a lead at once, types a character at a time and prints whole lines", () => {
        expect(typing([type(4, 2), print(3), print(2)])).toEqual([
            { line: 0, chars: 0, ms: START_MS },
            { line: 0, chars: 2, ms: CHAR_MS },
            { line: 0, chars: 3, ms: CHAR_MS },
            { line: 0, chars: 4, ms: PAUSE_MS },
            { line: 1, chars: 3, ms: LINE_MS },
            { line: 2, chars: 2, ms: DONE_MS },
        ]);
    });

    it("types on from the line above after an Enter, and pauses at a blank line or a new entry", () => {
        expect(typing([type(2, 2), more(3, 2), blank, print(4), type(3, 2)])).toEqual([
            { line: 0, chars: 0, ms: START_MS },
            { line: 0, chars: 2, ms: CHAR_MS },
            { line: 1, chars: 2, ms: CHAR_MS },
            { line: 1, chars: 3, ms: PAUSE_MS },
            { line: 3, chars: 4, ms: PAUSE_MS },
            { line: 4, chars: 2, ms: CHAR_MS },
            { line: 4, chars: 3, ms: DONE_MS },
        ]);
    });

    it("pauses between printed lines a blank line parts", () => {
        expect(typing([print(1), blank, print(1)]).map((shot) => shot.ms)).toEqual([
            START_MS,
            PAUSE_MS,
            DONE_MS,
        ]);
    });

    it("has nothing to type in an empty terminal", () => {
        expect(typing([blank])).toEqual([]);
        expect(typed([])).toBe(0);
    });
});

describe("timeline", () => {
    it("plays each terminal in turn, its bar as long as its typing, then rests", () => {
        const a = [type(3, 2)];
        const b = [print(2)];
        expect(timeline([a, b])).toEqual([
            { step: 0, line: 0, chars: 0, ms: START_MS, bar: START_MS + CHAR_MS },
            { step: 0, line: 0, chars: 2, ms: CHAR_MS },
            { step: 0, line: 0, chars: 3, ms: DONE_MS },
            { step: 1, line: 0, chars: 0, ms: START_MS, bar: START_MS },
            { step: 1, line: 0, chars: 2, ms: DONE_MS },
            { step: -1, line: -1, chars: 0, ms: REST_MS },
        ]);
    });
});
