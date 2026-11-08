import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { parseSummary } from "../../lib/stats/parse";
import { fakeSummary } from "../../lib/stats/testing/fake-data";
import type { StatsSummary } from "../../lib/stats/types";
import { StatsState } from "../stats/stats-provider";
import { FromPrice } from "./from-price";

afterEach(cleanup);

function renderWith(data: StatsSummary | null) {
    return render(
        <StatsState summary={{ data, updatedAt: null, failedAt: null }}>
            <FromPrice />
        </StatsState>,
    );
}

const data = parseSummary(fakeSummary(1, "normal")) as StatsSummary;

it("names the lowest price on sale", () => {
    const cheap = data.packages[0];
    if (!cheap) throw new Error("the fake feed sells nothing");
    const { container } = renderWith({
        ...data,
        packages: [
            { ...cheap, id: "dear", priceMicros: 2_400_000 },
            { ...cheap, id: "cheap", priceMicros: 50_000 },
        ],
    });
    expect(container.textContent).toBe("From 0.05 USDC per run");
});

it("renders nothing without a price", () => {
    expect(renderWith(null).container.textContent).toBe("");
    cleanup();
    expect(renderWith({ ...data, packages: [] }).container.textContent).toBe("");
});
