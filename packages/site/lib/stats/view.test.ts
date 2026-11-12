import { describe, expect, it } from "vitest";
import { parseSummary } from "./parse";
import { fakeSummary } from "./testing/fake-data";
import type { StatsSummary } from "./types";
import {
    defaultRange,
    formatClock,
    formatDay,
    formatHours,
    isStale,
    rangeDays,
    signedUsdc,
    STALE_MS,
} from "./view";

const summary = parseSummary(fakeSummary(1, "normal")) as StatsSummary;
const generated = Date.parse(summary.generatedAt);

describe("range", () => {
    it("defaults to 30 days, or all of them when there are fewer", () => {
        expect(defaultRange(90)).toBe("30d");
        expect(defaultRange(30)).toBe("30d");
        expect(defaultRange(29)).toBe("all");
        expect(defaultRange(1)).toBe("all");
    });

    it("keeps the newest days of the range, oldest first", () => {
        const week = rangeDays(summary.daily, "7d");
        expect(week).toHaveLength(7);
        expect(week.at(-1)).toBe(summary.daily.at(-1));
        expect(rangeDays(summary.daily, "30d")).toHaveLength(30);
        expect(rangeDays(summary.daily, "all")).toHaveLength(90);
        expect(rangeDays(summary.daily.slice(0, 3), "30d")).toHaveLength(3);
    });
});

describe("isStale", () => {
    const fresh = { data: summary, updatedAt: new Date(generated + 1_000), failedAt: null };

    it("is fresh after a good fetch of recent data, and before any fetch", () => {
        expect(isStale(fresh)).toBe(false);
        expect(isStale({ data: null, updatedAt: null, failedAt: null })).toBe(false);
    });

    it("is stale when the last fetch failed", () => {
        expect(isStale({ ...fresh, failedAt: new Date(generated + 30_000) })).toBe(true);
        expect(isStale({ data: null, updatedAt: null, failedAt: new Date() })).toBe(true);
    });

    it("is stale when the data was more than 5 minutes old when it arrived", () => {
        expect(isStale({ ...fresh, updatedAt: new Date(generated + STALE_MS) })).toBe(false);
        expect(isStale({ ...fresh, updatedAt: new Date(generated + STALE_MS + 1_000) })).toBe(true);
    });
});

describe("formats", () => {
    it("reads a feed time as the local clock", () => {
        const at = new Date(2026, 10, 7, 9, 5, 3);
        expect(formatClock(at.toISOString())).toBe("09:05:03");
    });

    it("reads a UTC day as day and month", () => {
        expect(formatDay("2026-11-07")).toBe("7 Nov");
        expect(formatDay("2026-01-31")).toBe("31 Jan");
    });

    it("turns compute seconds into hours to one decimal", () => {
        expect(formatHours(0)).toBe("0.0");
        expect(formatHours(5_400)).toBe("1.5");
        expect(formatHours(3_600 * 12_345)).toBe("12,345.0");
    });

    it("signs a negative amount with a minus sign, down to one micro, and never a zero", () => {
        expect(signedUsdc(-2_500_000)).toEqual({ text: "−2.50", negative: true });
        expect(signedUsdc(2_500_000)).toEqual({ text: "2.50", negative: false });
        expect(signedUsdc(-1)).toEqual({ text: "−0.000001", negative: true });
        expect(signedUsdc(-0)).toEqual({ text: "0.00", negative: false });
    });
});
