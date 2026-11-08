import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { SummaryState } from "../../lib/stats/client";
import { formatUsdc } from "../../lib/stats/format";
import { parseSummary } from "../../lib/stats/parse";
import { fakeSummary } from "../../lib/stats/testing/fake-data";
import type { StatsSummary } from "../../lib/stats/types";
import { Headline } from "./headline";
import { StatsState } from "./stats-provider";

afterEach(cleanup);

const unavailable = "Stats are unavailable right now.";
const data = parseSummary(fakeSummary(1, "normal")) as StatsSummary;

function show(summary: SummaryState) {
    return render(
        <StatsState summary={summary}>
            <Headline />
        </StatsState>,
    );
}

it("shows the six totals in order, money in USDC and a loss in the bad colour", () => {
    const loss = { ...data, totals: { ...data.totals, spentMicros: data.totals.earnedMicros * 2 } };
    show({ data: loss, updatedAt: new Date(), failedAt: null });
    expect(screen.getAllByRole("term").map((t) => t.textContent)).toEqual([
        "Active now",
        "Sandboxes run",
        "Compute hours sold",
        "Earned",
        "Spent on providers",
        "Profit",
    ]);
    const values = screen.getAllByRole("definition");
    expect(values[3]?.textContent).toBe(`${formatUsdc(data.totals.earnedMicros)}USDC`);
    const profit = values[5]?.firstElementChild;
    expect(profit?.textContent).toMatch(/^\u2212/);
    expect(profit?.className).toContain("text-bad");
});

it("stays empty while the first fetch is in flight, and says so once it fails", () => {
    const { rerender } = show({ data: null, updatedAt: null, failedAt: null });
    expect(screen.queryByText(unavailable)).toBeNull();
    for (const value of screen.getAllByRole("definition")) expect(value.textContent).toBe("");
    rerender(
        <StatsState summary={{ data: null, updatedAt: null, failedAt: new Date() }}>
            <Headline />
        </StatsState>,
    );
    expect(screen.getByText(unavailable)).toBeTruthy();
});
