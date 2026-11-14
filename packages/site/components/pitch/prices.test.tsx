import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { SummaryState } from "../../lib/stats/client";
import { parseSummary } from "../../lib/stats/parse";
import { fakeSummary } from "../../lib/stats/testing/fake-data";
import type { StatsSummary } from "../../lib/stats/types";
import { StatsState } from "../stats/stats-provider";
import { Prices } from "./prices";

afterEach(cleanup);

const data = parseSummary(fakeSummary(1, "normal")) as StatsSummary;

function show(summary: SummaryState) {
    return render(
        <StatsState summary={summary}>
            <Prices />
        </StatsState>,
    );
}

const body = () => screen.getAllByRole("rowgroup")[1] as HTMLElement;

it("lists the feed's packages with their prices", () => {
    show({ data, updatedAt: new Date(), failedAt: null });
    expect(body().querySelectorAll("tr")).toHaveLength(data.packages.length);
    expect(body().textContent).toContain("0.05 USDC");
});

it("pulses four skeleton rows while the feed loads, with no price", () => {
    show({ data: null, updatedAt: null, failedAt: null });
    expect(body().querySelectorAll("tr")).toHaveLength(4);
    expect(body().querySelectorAll(".animate-pulse")).toHaveLength(20);
    expect(body().textContent).not.toContain("USDC");
});

it("says once that stats are unavailable when the feed is off", () => {
    show({ data: null, updatedAt: null, failedAt: new Date() });
    expect(body().textContent).toBe("Stats are unavailable right now.");
});
