import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatUsdc } from "../../lib/stats/format";
import { parseSummary } from "../../lib/stats/parse";
import { fakeSummary, type Scenario } from "../../lib/stats/testing/fake-data";
import type { StatsSummary } from "../../lib/stats/types";
import { axisWidth, niceScale } from "./axis";
import { endPlaces, MoneyChart, scaleOf } from "./money-chart";
import { StatsState } from "./stats-provider";

// jsdom lays nothing out, so the chart is given a size to draw into
beforeEach(() => {
    vi.stubGlobal(
        "ResizeObserver",
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
        DOMRect.fromRect({ width: 800, height: 320 }),
    );
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function show(scenario: Scenario) {
    const data = parseSummary(fakeSummary(1, scenario)) as StatsSummary;
    return render(
        <StatsState summary={{ data, updatedAt: new Date(), failedAt: null }}>
            <MoneyChart />
        </StatsState>,
    );
}

const bars = (root: Element) => root.querySelectorAll(".recharts-bar-rectangle").length;

it("draws an all-zero day with no NaN in any coordinate", () => {
    const { container } = show("empty");
    expect(container.querySelector(".recharts-surface")).not.toBeNull();
    const coordinates = [...container.querySelectorAll("svg *")].flatMap((el) =>
        ["d", "x", "y"].map((name) => el.getAttribute(name) ?? ""),
    );
    expect(coordinates.join(" ")).not.toContain("NaN");
});

it("starts on 30 days and shows 7 bars once 7 d is chosen", async () => {
    const { container } = show("normal");
    expect(screen.getByRole("radio", { name: "30 days" }).getAttribute("aria-checked")).toBe(
        "true",
    );
    expect(bars(container)).toBe(30);
    await act(async () => {
        fireEvent.click(screen.getByRole("radio", { name: "7 days" }));
    });
    expect(bars(container)).toBe(7);
});

it("labels each line's last point with its value", () => {
    const { container } = show("normal");
    const data = parseSummary(fakeSummary(1, "normal")) as StatsSummary;
    const today = data.daily.at(-1) as StatsSummary["daily"][number];
    const labels = [...container.querySelectorAll(".recharts-label-list text")].map(
        (t) => t.textContent,
    );
    expect(labels).toEqual([formatUsdc(today.spentMicros ?? 0), formatUsdc(today.earnedMicros)]);
});

describe("scaleOf", () => {
    it("widens the y range to round steps with zero as a tick", () => {
        const { domain, ticks } = scaleOf([
            { day: "a", earned: 5.25, spent: 2.78, profit: -3.22 },
        ] as Parameters<typeof scaleOf>[0]);
        expect(domain).toEqual([-5, 7.5]);
        expect(ticks).toEqual([-5, -2.5, 0, 2.5, 5, 7.5]);
    });

    it("writes every tick to the decimals its step needs", () => {
        const at = (values: number[]) => niceScale(values).decimals;
        expect(at([5.25, -3.22])).toBe(1);
        expect(at([40])).toBe(0);
        expect(at([0.9])).toBe(2);
    });

    it("never steps a count by less than one", () => {
        expect(niceScale([1], 1).ticks).toEqual([0, 1]);
        expect(niceScale([39], 1).ticks).toEqual([0, 10, 20, 30, 40]);
    });

    it("draws an empty history as 0 to 1", () => {
        expect(scaleOf([]).domain).toEqual([0, 1]);
    });
});

describe("endPlaces", () => {
    it("centres each label level with its own point when the lines end apart", () => {
        expect(endPlaces(100, 200, 0, 300)).toEqual({ earned: 100, spent: 200 });
    });

    it("parts the labels evenly round their middle when the lines end together", () => {
        expect(endPlaces(100, 102, 0, 300)).toEqual({ earned: 93, spent: 109 });
        expect(endPlaces(102, 100, 0, 300)).toEqual({ earned: 109, spent: 93 });
    });

    it("keeps both labels inside the plot at its edges", () => {
        expect(endPlaces(295, 298, 0, 300)).toEqual({ earned: 276, spent: 292 });
        expect(endPlaces(2, 0, 0, 300)).toEqual({ earned: 24, spent: 8 });
        expect(endPlaces(0, 16, 0, 300)).toEqual({ earned: 8, spent: 24 });
    });
});

describe("axisWidth", () => {
    it("fits the longest label, so stacked charts share one plot edge", () => {
        expect(axisWidth(["0", "-2.5", "7.5"])).toBe(axisWidth(["-2.5"]));
        expect(axisWidth(["40"])).toBeLessThan(axisWidth(["-2.5"]));
    });
});
