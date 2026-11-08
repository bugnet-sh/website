import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { parseSummary } from "../../lib/stats/parse";
import { fakeSummary } from "../../lib/stats/testing/fake-data";
import type { StatsSummary } from "../../lib/stats/types";
import { StatsHead } from "./head";
import { StatsState } from "./stats-provider";

afterEach(cleanup);

const data = parseSummary(fakeSummary(1, "normal")) as StatsSummary;
const generated = Date.parse(data.generatedAt);

it("has the page's one H1 and the time the data was made", () => {
    render(
        <StatsState summary={{ data, updatedAt: new Date(generated + 1_000), failedAt: null }}>
            <StatsHead />
        </StatsState>,
    );
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual([
        "Stats",
    ]);
    expect(screen.getByText(/^\d\d:\d\d:\d\d$/).getAttribute("dateTime")).toBe(data.generatedAt);
    expect(screen.queryByRole("img", { name: "Data may be out of date" })).toBeNull();
});

it("turns the dot to warn when the last refresh failed", () => {
    const updatedAt = new Date(generated + 1_000);
    render(
        <StatsState summary={{ data, updatedAt, failedAt: new Date(generated + 31_000) }}>
            <StatsHead />
        </StatsState>,
    );
    const dot = screen.getByRole("img", { name: "Data may be out of date" });
    expect(dot.className).toContain("bg-warn");
});
