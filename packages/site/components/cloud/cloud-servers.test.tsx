import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SummaryState } from "../../lib/stats/client";
import { parseSummary } from "../../lib/stats/parse";
import { fakeSummary } from "../../lib/stats/testing/fake-data";
import type { ProviderRow, StatsSummary } from "../../lib/stats/types";
import { catalogPackages } from "../../lib/landing/catalog";
import { StatsState } from "../stats/stats-provider";
import { CloudServers } from "./cloud-servers";

afterEach(cleanup);

const loading: SummaryState = { data: null, updatedAt: null, failedAt: null };
const off: SummaryState = { data: null, updatedAt: null, failedAt: new Date() };
const fake = parseSummary(fakeSummary(1, "normal")) as StatsSummary;

/** The live feed, selling the router's catalog, with these provider rows */
const live = (providers: ProviderRow[]): SummaryState => ({
    data: { ...fake, packages: catalogPackages(), providers },
    updatedAt: new Date(),
    failedAt: null,
});

function show(summary: SummaryState) {
    return render(
        <StatsState summary={summary}>
            <CloudServers />
        </StatsState>,
    );
}

const cards = () => screen.getAllByRole("article");
const titles = () => cards().map((c) => c.querySelector("h2")?.textContent);
const card = (title: string) => {
    const found = cards().find((c) => c.querySelector("h2")?.textContent === title);
    if (!found) throw new Error(`no card ${title}`);
    return found;
};
const fact = (c: HTMLElement, label: string) =>
    within(c).getByText(label, { selector: "dt" }).nextElementSibling?.textContent;
const showing = () => screen.getByText(/^Showing/).textContent;
const tick = (name: string) => fireEvent.click(screen.getByRole("checkbox", { name }));

describe("CloudServers", () => {
    it("shows the nine servers from the catalog while the feed loads, cheapest first", () => {
        show(loading);
        expect(titles()).toEqual([
            "E2B 2 vCPU, 2 GiB 2x2",
            "Boat 2 vCPU, 4 GiB small",
            "boxd 2 vCPU, 8 GiB 2x8",
            "E2B 4 vCPU, 8 GiB 4x8",
            "Boat 4 vCPU, 8 GiB default",
            "boxd 4 vCPU, 16 GiB 4x16",
            "Boat 8 vCPU, 16 GiB large",
            "boxd 8 vCPU, 32 GiB 8x32",
            "Boat 16 vCPU, 32 GiB xlarge",
        ]);
        expect(showing()).toBe("Showing 9 of 9 servers");
    });

    it("shows a server's specs, its packages and its cheapest package's price", () => {
        show(loading);
        const boat = card("Boat 2 vCPU, 4 GiB small");
        expect(boat.querySelector("p")?.textContent).toBe("From 0.05 USDC / 10 min");
        expect(fact(boat, "CPU")).toBe("2 vCPU");
        expect(fact(boat, "Memory")).toBe("4 GiB");
        expect(fact(boat, "Disk")).toBe("51 GiB");
        expect(fact(boat, "GPU")).toBe("None");
        expect(fact(boat, "Location")).toBe("Germany, Finland or France");
        expect(fact(boat, "Longest run")).toBe("30 days");
        expect(fact(boat, "Runs as")).toBe("user");
        expect(
            within(boat)
                .getAllByRole("listitem")
                .map((li) => li.textContent),
        ).toEqual(["small-10m", "medium-10m"]);
        const site = within(boat).getByRole("link", { name: "boat.dev (opens in a new tab)" });
        expect(site.getAttribute("href")).toBe("https://boat.dev");
        expect(site.getAttribute("target")).toBe("_blank");
        expect(card("E2B 2 vCPU, 2 GiB 2x2").textContent).not.toContain("EU");
    });

    it("filters by provider and package, counts what shows, and clears", () => {
        show(loading);
        tick("Boat 4");
        expect(cards()).toHaveLength(4);
        expect(showing()).toBe("Showing 4 of 9 servers");
        tick("xlarge-10m 2");
        expect(titles()).toEqual(["Boat 8 vCPU, 16 GiB large"]);
        // The second Clear all is the narrow screens' own, under the choices
        expect(screen.getAllByRole("button", { name: "Clear all" })).toHaveLength(2);
        fireEvent.click(screen.getAllByRole("button", { name: "Clear all" })[0] as HTMLElement);
        expect(cards()).toHaveLength(9);
    });

    it("searches, and offers to clear the filters when nothing matches", () => {
        show(loading);
        const search = screen.getByRole("textbox", { name: "Search servers" });
        fireEvent.change(search, { target: { value: "4x16" } });
        expect(titles()).toEqual(["boxd 4 vCPU, 16 GiB 4x16"]);
        fireEvent.change(search, { target: { value: "gpu-h100" } });
        expect(screen.queryAllByRole("article")).toHaveLength(0);
        expect(screen.getByText("No server matches.")).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
        expect(cards()).toHaveLength(9);
        expect((search as HTMLInputElement).value).toBe("");
    });

    it("sorts by the chosen key", () => {
        show(loading);
        const sort = screen.getByRole("combobox", { name: "Sort" });
        expect((sort as HTMLSelectElement).value).toBe("price");
        fireEvent.change(sort, { target: { value: "memory" } });
        expect(titles().slice(0, 2)).toEqual(["E2B 2 vCPU, 2 GiB 2x2", "Boat 2 vCPU, 4 GiB small"]);
        expect(titles().at(-1)).toBe("Boat 16 vCPU, 32 GiB xlarge");
    });

    it("folds the filters behind a button that counts them, for narrow screens", () => {
        show(loading);
        const button = screen.getByRole("button", { name: /^Filters/ });
        expect(button.className.split(" ")).toEqual(
            expect.arrayContaining(["hidden", "narrow:flex"]),
        );
        expect(button.getAttribute("aria-expanded")).toBe("false");
        const panel = document.getElementById(button.getAttribute("aria-controls") ?? "");
        expect(panel?.className.split(" ")).toContain("narrow:hidden");
        tick("E2B 2");
        expect(button.textContent).toBe("Filters1");
        fireEvent.click(button);
        expect(button.getAttribute("aria-expanded")).toBe("true");
        expect(panel?.className.split(" ")).not.toContain("narrow:hidden");
    });

    it("hides the filter rail's scrollbar while it scrolls on its own", () => {
        show(loading);
        const rail = screen.getByRole("complementary", { name: "Filters" });
        expect(rail.className.split(" ")).toEqual(
            expect.arrayContaining(["sticky", "overflow-y-auto", "scrollbar-hidden"]),
        );
    });
});

describe("a card's live provider numbers", () => {
    it("shows the provider's row from the feed", () => {
        show(
            live([
                {
                    provider: "boat",
                    sandboxes7d: 120,
                    active: 3,
                    startP50Ms: 2300,
                    startP95Ms: 5100,
                    failed7d: 2,
                },
                {
                    provider: "e2b",
                    sandboxes7d: 40,
                    active: 0,
                    startP50Ms: null,
                    startP95Ms: null,
                    failed7d: null,
                },
            ]),
        );
        const boat = card("Boat 2 vCPU, 4 GiB small");
        expect(fact(boat, "Running now:")).toBe("3");
        expect(fact(boat, "Sandboxes in 7 days:")).toBe("120");
        expect(fact(boat, "Median start:")).toBe("2.3 s");
        expect(fact(boat, "Failed in 7 days:")).toBe("2");
        const e2b = card("E2B 2 vCPU, 2 GiB 2x2");
        expect(fact(e2b, "Median start:")).toBe("Under 5 starts");
        expect(fact(e2b, "Failed in 7 days:")).toBe("Unavailable");
    });

    it("reads a provider the feed leaves out as one with nothing in 7 days", () => {
        show(live([]));
        const boxd = card("boxd 2 vCPU, 8 GiB 2x8");
        expect(fact(boxd, "Running now:")).toBe("0");
        expect(fact(boxd, "Sandboxes in 7 days:")).toBe("0");
        expect(fact(boxd, "Median start:")).toBe("Under 5 starts");
        expect(fact(boxd, "Failed in 7 days:")).toBe("0");
    });

    it("says Unavailable when the feed is off, and nothing while it loads", () => {
        show(off);
        const boat = card("Boat 2 vCPU, 4 GiB small");
        expect(fact(boat, "Running now:")).toBe("Unavailable");
        expect(card("Boat 2 vCPU, 4 GiB small").querySelector("p")?.textContent).toBe(
            "From 0.05 USDC / 10 min",
        );
        cleanup();
        show(loading);
        expect(fact(card("Boat 2 vCPU, 4 GiB small"), "Running now:")).toBe("");
    });

    it("prices from the live feed's packages when it answers", () => {
        const packages = catalogPackages().map((p) =>
            p.id === "small-10m" ? { ...p, priceMicros: 40_000 } : p,
        );
        show({ ...live([]), data: { ...fake, packages, providers: [] } });
        expect(card("E2B 2 vCPU, 2 GiB 2x2").querySelector("p")?.textContent).toBe(
            "From 0.04 USDC / 10 min",
        );
    });
});
