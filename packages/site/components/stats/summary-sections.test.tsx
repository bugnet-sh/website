import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { parseSummary } from "../../lib/stats/parse";
import { fakeSummary, hostileProvider, type Scenario } from "../../lib/stats/testing/fake-data";
import type { StatsSummary } from "../../lib/stats/types";
import { Limits } from "./limits";
import { PaymentsBreakdown } from "./payments-breakdown";
import { Providers } from "./providers";
import { StatsState } from "./stats-provider";
import { Usage } from "./usage";

// jsdom lays nothing out, so the usage chart is given a size to draw into
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
        DOMRect.fromRect({ width: 600, height: 200 }),
    );
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

const summary = (scenario: Scenario) => parseSummary(fakeSummary(1, scenario)) as StatsSummary;

function show(data: StatsSummary, children: ReactNode) {
    return render(
        <StatsState summary={{ data, updatedAt: new Date(), failedAt: null }}>
            {children}
        </StatsState>,
    );
}

it("renders a hostile provider name as text, never as markup", () => {
    const { container } = show(summary("hostile"), <Providers />);
    expect(screen.getByText(hostileProvider)).toBeDefined();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getAllByText("Under 5 starts").length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain("·");
});

it("lists only the limits the feed sends, in the table's order", () => {
    const data = summary("normal");
    show(
        {
            ...data,
            limits: {
                "transfer.max_file_bytes": 1_073_741_824,
                "wallet.max_concurrent": 5,
                "order.max_micros": 100_000_000,
            },
        },
        <Limits />,
    );
    const table = screen.getByRole("table", { name: "Limits" });
    const rows = within(table)
        .getAllByRole("row")
        .slice(1)
        // The name is the cell's own text, before the tip that follows it
        .map((tr) => [...tr.querySelectorAll("td")].map((td) => td.firstChild?.textContent));
    expect(rows).toEqual([
        ["Sandboxes running at once, per wallet", "5"],
        ["Largest single payment", "100.00 USDC"],
        ["Largest file transfer", "1 GiB"],
    ]);
    // Only the first has a reason to give, and gives it after its name
    expect(within(table).getAllByRole("button")).toHaveLength(1);
    expect(within(table).getByRole("button").closest("td")?.textContent).toContain(
        "Sandboxes running at once, per wallet",
    );
    const buy = screen.getByRole("table", { name: "What you can buy" });
    // The sample feed sells two GPU sizes of that shape, for 10 and for 30 minutes
    expect(within(buy).getAllByText("4 vCPU, 16 GiB, 1 GPU 20 GiB")).toHaveLength(2);
});

it("prices what you can buy exactly, in one column of lined-up decimals", () => {
    const data = summary("normal");
    const packages = data.packages.slice(0, 2).map((p, i) => ({
        ...p,
        priceMicros: [50_000, 25_000][i] as number,
    }));
    show({ ...data, packages }, <Limits />);
    const table = screen.getByRole("table", { name: "What you can buy" });
    const prices = within(table)
        .getAllByRole("row")
        .slice(1)
        .map((tr) => tr.querySelectorAll("td")[3]?.textContent);
    expect(prices).toEqual(["0.050USDC", "0.025USDC"]);
});

it("hides the method list when the feed has no methods", () => {
    const data = summary("normal");
    const { rerender } = show(data, <PaymentsBreakdown />);
    expect(screen.getByText("pay CLI")).toBeDefined();
    const none = { ...data, payments: { ...data.payments, byMethod: [] } };
    rerender(
        <StatsState summary={{ data: none, updatedAt: new Date(), failedAt: null }}>
            <PaymentsBreakdown />
        </StatsState>,
    );
    expect(screen.queryByText("By method")).toBeNull();
    expect(screen.queryByText("pay CLI")).toBeNull();
    expect(screen.getByText("x402 session fee")).toBeDefined();
});

it("draws the usage chart of a brand-new deployment with no NaN", () => {
    const { container } = show(summary("empty"), <Usage />);
    expect(container.querySelector(".recharts-surface")).not.toBeNull();
    expect(container.innerHTML).not.toContain("NaN");
    expect(screen.getByText("Median session").nextElementSibling?.textContent).toBe("0 s");
});
