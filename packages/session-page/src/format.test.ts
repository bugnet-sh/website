import { describe, expect, it } from "vitest";
import {
    formatBytes,
    formatClock,
    formatDuration,
    formatLeft,
    formatUsdc,
    plural,
    shortSignature,
    truncateLabel,
} from "./format.ts";

// Every space in a byte count or a duration is a no-break space
const nb = (s: string) => s.replaceAll(" ", "\u00a0");

describe("formatBytes", () => {
    it("uses binary units with one decimal below 10", () => {
        expect(formatBytes(0)).toBe(nb("0 B"));
        expect(formatBytes(1023)).toBe(nb("1023 B"));
        expect(formatBytes(1024)).toBe(nb("1 KiB"));
        expect(formatBytes(12_345)).toBe(nb("12 KiB"));
        expect(formatBytes(1_258_291)).toBe(nb("1.2 MiB"));
        expect(formatBytes(3 * 2 ** 30)).toBe(nb("3 GiB"));
    });

    it("moves up a unit instead of showing 1024 of the one below", () => {
        expect(formatBytes(2 ** 20 - 1)).toBe(nb("1 MiB"));
    });

    it("shows nothing negative", () => {
        expect(formatBytes(-5)).toBe(nb("0 B"));
    });

    it("keeps each number with its unit, so no line breaks inside a value", () => {
        expect(formatBytes(12_345)).toBe("12\u00a0KiB");
        expect(formatDuration(130_000)).toBe("2\u00a0min\u00a010\u00a0s");
        expect(formatDuration(9_200)).toBe("9.2\u00a0s");
    });
});

describe("formatDuration", () => {
    it("shows tenths below 10 s and whole units above", () => {
        expect(formatDuration(400)).toBe(nb("0.4 s"));
        expect(formatDuration(9_200)).toBe(nb("9.2 s"));
        expect(formatDuration(41_000)).toBe(nb("41 s"));
        expect(formatDuration(243_000)).toBe(nb("4 min 3 s"));
        expect(formatDuration(3_720_000)).toBe(nb("1 h 2 min"));
        expect(formatDuration(-5)).toBe(nb("0 s"));
    });

    it("never rounds up past the time that has passed", () => {
        expect(formatDuration(9_999)).toBe(nb("9.9 s"));
        expect(formatDuration(59_999)).toBe(nb("59 s"));
    });
});

describe("formatClock", () => {
    const now = new Date("2026-11-07T09:30:00Z");

    it("shows only the time on the same day", () => {
        expect(formatClock(new Date("2026-11-07T14:02:59Z"), now, "UTC")).toBe("14:02");
        expect(formatClock(new Date("2026-11-07T00:05:00Z"), now, "UTC")).toBe("00:05");
    });

    it("adds the date on another day", () => {
        expect(formatClock(new Date("2026-11-06T14:02:00Z"), now, "UTC")).toBe("6 Nov 14:02");
    });

    it("decides the day in the given time zone", () => {
        const late = new Date("2026-11-06T23:30:00Z");
        expect(formatClock(late, now, "UTC")).toBe("6 Nov 23:30");
        expect(formatClock(late, now, "Europe/Istanbul")).toBe("02:30");
    });
});

describe("formatLeft", () => {
    const now = new Date("2026-11-06T10:00:00Z");
    const ahead = (ms: number) => new Date(now.getTime() + ms);

    it("shows the largest whole unit", () => {
        expect(formatLeft(ahead(47 * 3_600_000), now)).toBe("47 h");
        expect(formatLeft(ahead(23 * 60_000), now)).toBe("23 min");
        expect(formatLeft(ahead(40_000), now)).toBe("40 s");
    });

    it("clamps at now", () => {
        expect(formatLeft(now, now)).toBe("now");
        expect(formatLeft(ahead(-1), now)).toBe("now");
        expect(formatLeft(ahead(-5 * 3_600_000), now)).toBe("now");
        expect(formatLeft(ahead(400), now)).toBe("now");
    });
});

describe("formatUsdc", () => {
    it("prints micros as exact decimals", () => {
        expect(formatUsdc(50_000)).toBe("0.05 USDC");
        expect(formatUsdc(3_000)).toBe("0.003 USDC");
        expect(formatUsdc(1_000_000)).toBe("1 USDC");
        expect(formatUsdc(0)).toBe("0 USDC");
        expect(formatUsdc(12_345_678)).toBe("12.345678 USDC");
    });
});

describe("shortSignature", () => {
    it("keeps the first and last 6 characters", () => {
        const tx = `abcdef${"x".repeat(76)}uvwxyz`;
        expect(tx).toHaveLength(88);
        expect(shortSignature(tx)).toBe("abcdef…uvwxyz");
    });

    it("leaves a short string whole", () => {
        expect(shortSignature("abc")).toBe("abc");
    });
});

describe("truncateLabel", () => {
    it("cuts a long host to 24 characters ending in an ellipsis", () => {
        const host = `${"a".repeat(55)}.example`;
        expect(host).toHaveLength(63);
        const cut = truncateLabel(host);
        expect(cut).toHaveLength(24);
        expect(cut).toBe(`${"a".repeat(23)}…`);
    });

    it("leaves a label that fits", () => {
        expect(truncateLabel("api.github.com")).toBe("api.github.com");
        expect(truncateLabel("a".repeat(24))).toBe("a".repeat(24));
    });

    it("counts code points, so an emoji is never split", () => {
        const label = `${"a".repeat(22)}😀😀😀`;
        const cut = truncateLabel(label);
        expect(Array.from(cut)).toHaveLength(24);
        expect(cut).toBe(`${"a".repeat(22)}😀…`);
        expect(cut).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
        expect(truncateLabel("😀".repeat(24))).toBe("😀".repeat(24));
    });

    it("takes another maximum", () => {
        expect(truncateLabel("abcdef", 4)).toBe("abc…");
    });
});

describe("plural", () => {
    it("puts the count before the right word", () => {
        expect(plural(1, "call", "calls")).toBe("1 call");
        expect(plural(0, "call", "calls")).toBe("0 calls");
        expect(plural(3, "tool call", "tool calls")).toBe("3 tool calls");
    });
});
