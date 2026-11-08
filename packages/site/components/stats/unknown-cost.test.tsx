import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { failureRate } from "../../lib/stats/labels";
import { parseSummary } from "../../lib/stats/parse";
import { fakeSummary } from "../../lib/stats/testing/fake-data";
import type { StatsSummary } from "../../lib/stats/types";
import { Headline } from "./headline";
import { MoneyChart } from "./money-chart";
import { StatsState } from "./stats-provider";

// The router serves our provider cost and failed starts as null until it can count them
function withUnknownCost(): unknown {
    const feed = fakeSummary(1, "normal") as {
        totals: Record<string, unknown>;
        daily: Record<string, unknown>[];
        providers: Record<string, unknown>[];
    };
    feed.totals.spentMicros = null;
    for (const day of feed.daily) day.spentMicros = null;
    for (const provider of feed.providers) provider.failed7d = null;
    return feed;
}

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

function show(children: React.ReactNode) {
    const data = parseSummary(withUnknownCost()) as StatsSummary;
    return render(
        <StatsState summary={{ data, updatedAt: new Date(), failedAt: null }}>
            {children}
        </StatsState>,
    );
}

it("reads a feed whose provider cost and failed starts are unknown", () => {
    const data = parseSummary(withUnknownCost());
    expect(data).not.toBeNull();
    expect(data?.totals.spentMicros).toBeNull();
    expect(data?.daily.every((d) => d.spentMicros === null)).toBe(true);
    expect(data?.packages.length).toBeGreaterThan(0);
});

it("says spent and profit are unavailable rather than inventing them", () => {
    show(<Headline />);
    expect(screen.getAllByText("Unavailable")).toHaveLength(2);
});

it("charts only what was earned while the cost is unknown", () => {
    const { container } = show(<MoneyChart />);
    expect(screen.getByText("Earned")).toBeTruthy();
    expect(screen.queryByText("Spent on providers")).toBeNull();
    expect(screen.queryByText("Profit")).toBeNull();
    expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(0);
});

it("gives an unknown failure rate as unavailable", () => {
    expect(failureRate({ failed7d: null, sandboxes7d: 4 })).toBe("Unavailable");
});
