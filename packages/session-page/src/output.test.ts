import { describe, expect, it } from "vitest";
import { DEFAULT_LIMITS, OutputBuffer } from "./output.js";

const o = (t: string, cr = false) => ({ s: "o" as const, t, cr });
const e = (t: string, cr = false) => ({ s: "e" as const, t, cr });

describe("OutputBuffer", () => {
    it("joins a split line across frames", () => {
        const b = new OutputBuffer();
        b.apply(o("a\nb"));
        b.apply(o("c\n"));
        expect(b.lines.map((l) => [l.t, l.open])).toEqual([
            ["a", false],
            ["bc", false],
        ]);
    });

    it("starts a new line when the stream changes", () => {
        const b = new OutputBuffer();
        b.apply(o("x"));
        b.apply(e("y\n"));
        expect(b.lines.map((l) => [l.s, l.t])).toEqual([
            ["o", "x"],
            ["e", "y"],
        ]);
    });

    it("replaces the last line on a carriage return", () => {
        const b = new OutputBuffer();
        b.apply(o("50%"));
        b.apply(o("60%", true));
        expect(b.lines.map((l) => l.t)).toEqual(["60%"]);
        expect(b.lines[0]!.open).toBe(true);
    });

    it("keeps empty lines", () => {
        const b = new OutputBuffer();
        b.apply(o("a\n\nb"));
        expect(b.text()).toBe("a\n\nb");
    });

    it("cuts one enormous line quickly", () => {
        const b = new OutputBuffer();
        const started = performance.now();
        b.apply(o("x".repeat(3 * 1024 * 1024)));
        b.apply(o("more"));
        expect(performance.now() - started).toBeLessThan(500);
        expect(b.lines).toHaveLength(1);
        expect(b.lines[0]!.t).toHaveLength(DEFAULT_LIMITS.maxLineChars + 1);
        expect(b.lines[0]!.t.endsWith("…")).toBe(true);
    });

    it("drops lines from the front past the line cap", () => {
        const b = new OutputBuffer();
        for (let i = 0; i < 6000; i++) b.apply(o(`l${i}\n`));
        expect(b.lines).toHaveLength(5000);
        expect(b.droppedLines).toBe(1000);
        expect(b.lines[0]!.t).toBe("l1000");
    });

    it("absorbs an 8 MiB flood within the char cap", () => {
        const b = new OutputBuffer();
        const chunk = `${"y".repeat(79)}\n`.repeat(1024);
        const started = performance.now();
        for (let i = 0; i < (8 * 1024 * 1024) / chunk.length; i++) b.apply(o(chunk));
        expect(performance.now() - started).toBeLessThan(1500);
        expect(b.text().length).toBeLessThanOrEqual(DEFAULT_LIMITS.maxChars);
        expect(b.droppedLines).toBeGreaterThan(0);
    });

    it("joins text with newlines", () => {
        const b = new OutputBuffer();
        b.apply(o("a\nb\nc"));
        expect(b.text()).toBe("a\nb\nc");
    });

    it("bumps the version on every change", () => {
        const b = new OutputBuffer();
        const v0 = b.version;
        b.apply(o("a"));
        const v1 = b.version;
        b.skip(10, 5);
        expect(v1).toBeGreaterThan(v0);
        expect(b.version).toBeGreaterThan(v1);
        expect(b.skippedBytes).toBe(15);
    });
});
