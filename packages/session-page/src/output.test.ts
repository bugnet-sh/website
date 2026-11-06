import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
import { describe, expect, expectTypeOf, it } from "vitest";
import { DEFAULT_LIMITS, OutputBuffer, type Line } from "./output.js";

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

    it("never cuts between the two halves of a character", () => {
        const b = new OutputBuffer();
        const kept = "a".repeat(DEFAULT_LIMITS.maxLineChars - 1);
        b.apply(o(`${kept}😀 and more`));
        b.apply(o("still the same line"));
        expect(b.lines).toHaveLength(1);
        const t = b.lines[0]!.t;
        expect(t.endsWith("…")).toBe(true);
        const last = t.charCodeAt(t.length - 2);
        expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
        expect(t).toBe(`${kept}…`);
    });

    it("starts a cut line afresh on a carriage return", () => {
        const b = new OutputBuffer();
        b.apply(o(`${"a".repeat(DEFAULT_LIMITS.maxLineChars - 1)}😀`));
        b.apply(o("fresh", true));
        expect(b.lines.map((l) => l.t)).toEqual(["fresh"]);
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

    it("hands out its lines read-only", () => {
        expectTypeOf(new OutputBuffer().lines).toEqualTypeOf<ReadonlyArray<Readonly<Line>>>();
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

    it("does not keep the source frames of cut lines alive", () => {
        setFlagsFromString("--expose-gc");
        const gc = runInNewContext("gc") as () => void;
        const used = (): number => {
            gc();
            const m = process.memoryUsage();
            return m.heapUsed + m.external;
        };
        // Decoded text is a flat string, the kind slice() turns into a view of the whole frame.
        const decoder = new TextDecoder();
        const b = new OutputBuffer();
        const before = used();
        for (let i = 0; i < 64; i++) {
            const bytes = new Uint8Array(3 * 1024 * 1024).fill(97 + (i % 26));
            bytes[bytes.length - 1] = 10;
            b.apply(o(decoder.decode(bytes)));
        }
        used();
        const grown = used() - before;
        expect(grown).toBeLessThan(16 * 1024 * 1024);
    });
});
