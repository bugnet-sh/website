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
    it("shows the eight servers the feed's packages land on, cheapest first", () => {
        show(live([]));
        expect(titles()).toEqual([
            "E2B 2 vCPU, 2 GiB 2x2",
            "Boat 2 vCPU, 4 GiB small",
            "boxd 2 vCPU, 8 GiB 2x8",
            "E2B 4 vCPU, 8 GiB 4x8",
            "Boat 4 vCPU, 8 GiB default",
            "boxd 4 vCPU, 16 GiB 4x16",
            "Boat 8 vCPU, 16 GiB large",
            "boxd 8 vCPU, 32 GiB 8x32",
        ]);
        expect(showing()).toBe("Showing 8 of 8 servers");
    });

    it("shows a server's specs, its packages and its cheapest package's price", () => {
        show(live([]));
        const boat = card("Boat 2 vCPU, 4 GiB small");
        expect(boat.querySelector("p")?.textContent).toBe("From 0.05 USDC / 10 min");
        expect(fact(boat, "CPU")).toBe("2 vCPU");
        expect(fact(boat, "Memory")).toBe("4 GiB");
        expect(fact(boat, "Disk")).toBe("51 GiB");
        expect(fact(boat, "GPU")).toBe("None");
        expect(fact(boat, "Location")).toBe("Germany, Finland or France");
        expect(fact(boat, "Longest run")).toBe("30 days");
        expect(fact(card("E2B 2 vCPU, 2 GiB 2x2"), "Longest run")).toBe("50 minutes");
        expect(fact(boat, "Runs as")).toBe("user");
        expect(
            within(boat)
                .getAllByRole("listitem")
                .map((li) => li.textContent),
        ).toEqual(["small-10m", "medium-10m"]);
        // The provider's name above the size links to its site
        const site = within(boat).getByRole("link", { name: "Boat (opens in a new tab)" });
        expect(site.getAttribute("href")).toBe("https://boat.dev");
        expect(site.getAttribute("target")).toBe("_blank");
        expect(card("E2B 2 vCPU, 2 GiB 2x2").textContent).not.toContain("EU");
    });

    it("lays every part of a card on one four-column grid, two columns on phones", () => {
        show(live([]));
        const boat = card("Boat 2 vCPU, 4 GiB small");
        const [head, ...grids] = [...boat.children] as HTMLElement[];
        expect(head?.className.split(" ")).toEqual(
            expect.arrayContaining(["grid", "grid-cols-4", "gap-x-(--hairline)"]),
        );
        expect(head?.children[0]?.className.split(" ")).toContain("col-span-3");
        const dls = boat.querySelectorAll("dl");
        expect(dls).toHaveLength(2);
        for (const dl of dls) {
            expect(dl.className.split(" ")).toEqual(
                expect.arrayContaining(["grid-cols-4", "gap-(--hairline)", "phone:grid-cols-2"]),
            );
            expect(dl.children.length % 4).toBe(0);
        }
        expect(grids).toHaveLength(2);
        // Values share one type: only package ids are code
        expect(boat.querySelectorAll("dd.font-mono, dd .font-mono:not(li)")).toHaveLength(0);
    });

    it("filters by provider and package, counts what shows, and clears", () => {
        show(live([]));
        tick("Boat 3 servers");
        expect(cards()).toHaveLength(3);
        expect(showing()).toBe("Showing 3 of 8 servers");
        tick("large-10m 3 servers");
        expect(titles()).toEqual(["Boat 4 vCPU, 8 GiB default"]);
        // The second Clear all is the narrow screens' own, under the choices
        expect(screen.getAllByRole("button", { name: "Clear all" })).toHaveLength(2);
        fireEvent.click(screen.getAllByRole("button", { name: "Clear all" })[0] as HTMLElement);
        expect(cards()).toHaveLength(8);
    });

    it("moves focus to the Filters button when a clear from the keyboard takes its button away", () => {
        show(live([]));
        tick("Boat 3 servers");
        // A key press clicks with no detail; jsdom draws no layout, so the Filters button shows
        fireEvent.click(screen.getAllByRole("button", { name: "Clear all" })[0] as HTMLElement, {
            detail: 0,
        });
        expect(document.activeElement).toBe(screen.getByRole("button", { name: /^Filters/ }));
    });

    it("searches, and offers to clear the filters when nothing matches", () => {
        show(live([]));
        const search = screen.getByRole("textbox", { name: "Search servers" });
        fireEvent.change(search, { target: { value: "4x16" } });
        expect(titles()).toEqual(["boxd 4 vCPU, 16 GiB 4x16"]);
        fireEvent.change(search, { target: { value: "gpu-h100" } });
        expect(screen.queryAllByRole("article")).toHaveLength(0);
        expect(screen.getByText("No server matches.")).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
        expect(cards()).toHaveLength(8);
        expect((search as HTMLInputElement).value).toBe("");
    });

    it("sorts by the chosen key", () => {
        show(live([]));
        const sort = screen.getByRole("combobox", { name: "Sort" });
        expect((sort as HTMLSelectElement).value).toBe("price");
        fireEvent.change(sort, { target: { value: "memory" } });
        expect(titles().slice(0, 2)).toEqual(["E2B 2 vCPU, 2 GiB 2x2", "Boat 2 vCPU, 4 GiB small"]);
        expect(titles().at(-1)).toBe("boxd 8 vCPU, 32 GiB 8x32");
    });

    it("folds the filters behind a button that counts them, for narrow screens", () => {
        show(live([]));
        const button = screen.getByRole("button", { name: /^Filters/ });
        expect(button.className.split(" ")).toEqual(
            expect.arrayContaining(["hidden", "narrow:flex"]),
        );
        expect(button.getAttribute("aria-expanded")).toBe("false");
        const panel = document.getElementById(button.getAttribute("aria-controls") ?? "");
        expect(panel?.className.split(" ")).toContain("narrow:hidden");
        tick("E2B 2 servers");
        expect(button.textContent).toBe("Filters, 1 on");
        fireEvent.click(button);
        expect(button.getAttribute("aria-expanded")).toBe("true");
        expect(panel?.className.split(" ")).not.toContain("narrow:hidden");
    });

    it("hides the filter rail's scrollbar while it scrolls on its own", () => {
        show(live([]));
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
        expect(fact(boat, "Running now")).toBe("3");
        expect(fact(boat, "Sandboxes in 7 days")).toBe("120");
        expect(fact(boat, "Median start")).toBe("2.3 s");
        expect(fact(boat, "Failed in 7 days")).toBe("2");
        const e2b = card("E2B 2 vCPU, 2 GiB 2x2");
        expect(fact(e2b, "Median start")).toBe("Under 5 starts");
        expect(fact(e2b, "Failed in 7 days")).toBe("Unavailable");
    });

    it("reads a provider the feed leaves out as one with nothing in 7 days", () => {
        show(live([]));
        const boxd = card("boxd 2 vCPU, 8 GiB 2x8");
        expect(fact(boxd, "Running now")).toBe("0");
        expect(fact(boxd, "Sandboxes in 7 days")).toBe("0");
        expect(fact(boxd, "Median start")).toBe("Under 5 starts");
        expect(fact(boxd, "Failed in 7 days")).toBe("0");
    });

    it("pulses three skeleton cards and the choices while the feed loads, with no price", () => {
        show(loading);
        expect(screen.queryAllByRole("article")).toHaveLength(0);
        expect(screen.queryByText(/USDC/)).toBeNull();
        expect(screen.getByText("Loading servers").className).toContain("sr-only");
        expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
        const list = document.querySelector('ul[aria-hidden="true"].grid');
        expect(list?.children).toHaveLength(3);
        expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    });

    it("says once that stats are unavailable when the feed is off, over one still card", () => {
        show(off);
        expect(screen.getAllByText("Stats are unavailable right now.")).toHaveLength(1);
        expect(screen.queryByText("Loading servers")).toBeNull();
        expect(screen.queryAllByRole("article")).toHaveLength(0);
        expect(screen.queryByText(/USDC/)).toBeNull();
        expect(document.querySelectorAll(".animate-pulse")).toHaveLength(0);
        const list = document.querySelector('ul[aria-hidden="true"].grid');
        expect(list?.children).toHaveLength(1);
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
