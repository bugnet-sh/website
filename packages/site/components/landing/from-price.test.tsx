import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { parseSummary } from "../../lib/stats/parse";
import { fakeSummary } from "../../lib/stats/testing/fake-data";
import type { StatsSummary } from "../../lib/stats/types";
import { FromPrice } from "./from-price";

const summary = vi.hoisted(() => ({ data: null as unknown }));
vi.mock("../../lib/stats/client", () => ({
    useStatsSummary: () => ({ data: summary.data, updatedAt: null, failedAt: null }),
}));

afterEach(cleanup);

const data = parseSummary(fakeSummary(1, "normal")) as StatsSummary;

it("names the lowest price on sale", () => {
    const cheap = data.packages[0];
    if (!cheap) throw new Error("the fake feed sells nothing");
    summary.data = {
        ...data,
        packages: [
            { ...cheap, id: "dear", priceMicros: 2_400_000 },
            { ...cheap, id: "cheap", priceMicros: 50_000 },
        ],
    };
    const { container } = render(<FromPrice />);
    expect(container.textContent).toBe("From 0.05 USDC per run");
});

it("renders nothing without a price", () => {
    summary.data = null;
    expect(render(<FromPrice />).container.textContent).toBe("");
    cleanup();
    summary.data = { ...data, packages: [] };
    expect(render(<FromPrice />).container.textContent).toBe("");
});
