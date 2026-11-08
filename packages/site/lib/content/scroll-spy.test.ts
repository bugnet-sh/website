import { describe, expect, it } from "vitest";
import { currentHeading } from "./scroll-spy";

const at = (...tops: number[]) => tops.map((top, i) => ({ id: `h${i}`, top }));

describe("currentHeading", () => {
    it("is the last heading at or above the line", () => {
        expect(currentHeading(at(-400, -20, 90, 600), 90)).toBe("h2");
        expect(currentHeading(at(-400, -20, 91, 600), 90)).toBe("h1");
    });

    it("is the first heading before any reaches the line", () => {
        expect(currentHeading(at(300, 900), 90)).toBe("h0");
    });

    it("is nothing without headings", () => {
        expect(currentHeading([], 90)).toBeUndefined();
    });
});
