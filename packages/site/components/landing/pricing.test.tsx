import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { SummaryState } from "../../lib/stats/client";
import { parseSummary } from "../../lib/stats/parse";
import { fakeSummary } from "../../lib/stats/testing/fake-data";
import type { PackageRow, StatsSummary } from "../../lib/stats/types";
import { StatsState } from "../stats/stats-provider";
import { Pricing } from "./pricing";

afterEach(cleanup);

const data = parseSummary(fakeSummary(1, "normal")) as StatsSummary;

const pack = (id: string, minutes: number, priceMicros: number): PackageRow => ({
    id,
    vcpu: 2,
    memoryMiB: 2048,
    diskGiB: 10,
    gpu: null,
    minutes,
    priceMicros,
});

function show(summary: SummaryState) {
    return render(
        <StatsState summary={summary}>
            <Pricing />
        </StatsState>,
    );
}

const showPackages = (packages: PackageRow[]) =>
    show({ data: { ...data, packages }, updatedAt: new Date(), failedAt: null });

it("prices every package for its own length, which no row repeats", () => {
    showPackages([pack("short", 10, 50_000), pack("long", 30, 180_000)]);
    const [short, long] = screen.getAllByRole("listitem") as [HTMLElement, HTMLElement];
    expect(short.querySelector("p")?.textContent).toBe("0.05USDC / 10 min");
    expect(long.querySelector("p")?.textContent).toBe("0.18USDC / 30 min");
    expect(within(short).queryByText("Time")).toBeNull();
});

it("names each GPU coming soon in its head, with its VRAM and one small Coming soon, no price", () => {
    showPackages([pack("cpu", 10, 50_000)]);
    const soon = screen.getAllByRole("listitem").slice(1);
    expect(soon.map((cell) => cell.querySelector("p")?.textContent)).toEqual([
        "NVIDIA H100",
        "NVIDIA A100",
        "NVIDIA L40S",
        "NVIDIA L4",
    ]);
    for (const cell of soon) {
        expect(
            within(cell)
                .getAllByRole("term")
                .map((t) => t.textContent),
        ).toEqual(["VRAM"]);
        expect(within(cell).getAllByText("Coming soon")).toHaveLength(1);
        expect(cell.textContent).not.toContain("USDC");
    }
});

it("pulses a skeleton for each package place while the feed loads, then the GPUs, no price", () => {
    show({ data: null, updatedAt: null, failedAt: null });
    const cells = screen.getAllByRole("listitem");
    expect(cells).toHaveLength(8);
    expect(screen.queryByText(/USDC/)).toBeNull();
    expect(cells.slice(0, 4).every((c) => c.querySelector(".animate-pulse"))).toBe(true);
    expect(cells[4]?.textContent).toContain("NVIDIA H100");
    expect(screen.queryByText(/unavailable/i)).toBeNull();
});

it("says once that stats are unavailable when the feed fails, over still skeletons", () => {
    show({ data: null, updatedAt: null, failedAt: new Date() });
    expect(screen.getAllByText("Stats are unavailable right now.")).toHaveLength(1);
    expect(screen.queryByText(/USDC/)).toBeNull();
    expect(document.querySelectorAll(".animate-pulse")).toHaveLength(0);
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
});
