import { describe, expect, it } from "vitest";
import { insideDistance } from "./logo-source";

describe("insideDistance", () => {
    it("measures each inside pixel to the nearest outside one, the border counting as outside", () => {
        // prettier-ignore
        const inside = new Uint8Array([
            1, 1, 1, 1, 1, 1, 1,
            1, 1, 1, 1, 1, 1, 1,
            1, 0, 1, 1, 1, 1, 1,
        ]);
        const d = [...insideDistance(inside, 7, 3)].map((v) => Math.round(v * 100) / 100);
        // prettier-ignore
        expect(d).toEqual([
            1, 1, 1, 1, 1, 1, 1,
            1, 1, 1.41, 2, 2, 2, 1,
            1, 0, 1, 1, 1, 1, 1,
        ]);
    });
});
