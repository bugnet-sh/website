import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SiteFooter } from "./footer";

afterEach(cleanup);

function footer() {
    return screen.getByRole("contentinfo");
}

describe("SiteFooter", () => {
    it("links every page and both outside profiles", () => {
        render(<SiteFooter />);
        const links = within(footer()).getAllByRole("link");
        expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
            ["Home", "/"],
            ["Docs", "/docs/"],
            ["Stats", "/stats/"],
            ["Terms", "/terms/"],
            ["Privacy", "/privacy/"],
            ["GitHub (opens in a new tab)", "https://github.com/bugnet-sh/bugnet"],
            ["X (opens in a new tab)", "https://x.com/bugnetsh"],
        ]);
    });

    it("opens GitHub and X in a new tab without a referrer", () => {
        render(<SiteFooter />);
        for (const name of ["GitHub (opens in a new tab)", "X (opens in a new tab)"]) {
            const link = within(footer()).getByRole("link", { name });
            expect(link.getAttribute("target"), name).toBe("_blank");
            expect(link.getAttribute("rel"), name).toBe("noreferrer");
        }
    });

    it("holds the brand, its one sentence and the copyright", () => {
        render(<SiteFooter />);
        expect(within(footer()).getByText("Bugnet")).toBeDefined();
        expect(
            within(footer()).getByText(
                "Pay-per-run sandboxes for AI agents, paid in USDC on Solana.",
            ),
        ).toBeDefined();
        expect(within(footer()).getByText("© 2026 Bugnet")).toBeDefined();
    });

    it("lays the brand and the two link columns on one grid at every width", () => {
        render(<SiteFooter />);
        const grid = within(footer()).getByText("© 2026 Bugnet").closest("div")?.parentElement;
        expect(grid?.className.split(" ")).toEqual(
            expect.arrayContaining([
                "grid-cols-[1fr_auto_auto]",
                "gap-x-(--space-8)",
                "gap-y-(--space-6)",
                "pt-(--space-7)",
                "pb-(--space-8)",
                "px-(--pad)",
                "tablet:grid-cols-2",
                "phone:grid-cols-1",
            ]),
        );
        const [brand, ...columns] = [...(grid?.children ?? [])];
        expect(brand?.className.split(" ")).toEqual(
            expect.arrayContaining(["tablet:col-span-2", "phone:col-span-1"]),
        );
        expect(columns).toHaveLength(2);
        // One group against the right edge on desktop, each column's links starting on one line
        for (const column of columns) {
            const classes = column.className.split(" ");
            expect(classes).not.toContain("justify-self-end");
            expect(classes).toContain("tablet:pt-0");
        }
    });

    it("ends with an empty waves slot of fixed height, hidden from assistive tech", () => {
        render(<SiteFooter />);
        const slot = screen.getByTestId("waves-slot");
        expect(slot.getAttribute("aria-hidden")).toBe("true");
        expect(slot.childNodes).toHaveLength(0);
        expect(slot.className.split(" ")).toContain("h-(--waves)");
        // Rail to rail: the slot sits in an unpadded frame, after everything else in the footer
        expect(slot.parentElement?.lastElementChild).toBe(slot);
        expect(slot.parentElement?.className).not.toContain("px-");
        expect(footer().lastElementChild).toBe(slot.parentElement);
    });
});
