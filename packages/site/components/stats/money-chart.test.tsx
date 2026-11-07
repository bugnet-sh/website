import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { formatUsdc } from "../../lib/stats/format";
import { parseSummary } from "../../lib/stats/parse";
import { fakeSummary, type Scenario } from "../../lib/stats/testing/fake-data";
import type { StatsSummary } from "../../lib/stats/types";
import { MoneyChart } from "./money-chart";
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
    expect(labels).toEqual([formatUsdc(today.spentMicros), formatUsdc(today.earnedMicros)]);
});
