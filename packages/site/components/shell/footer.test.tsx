import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SiteFooter } from "./footer";

afterEach(cleanup);

function footer() {
    return screen.getByRole("contentinfo");
}

describe("SiteFooter", () => {
    it("links GitHub and X as icons, then the site, developer and legal pages, column by column", () => {
        render(<SiteFooter />);
        const links = within(footer()).getAllByRole("link");
        expect(
            links.map((l) => [
                l.getAttribute("aria-label") ?? l.textContent,
                l.getAttribute("href"),
            ]),
        ).toEqual([
            ["GitHub (opens in a new tab)", "https://github.com/bugnet-sh/bugnet"],
            ["X (opens in a new tab)", "https://x.com/bugnetsh"],
            ["Home", "/"],
            ["How it works", "/#how"],
            ["Pricing", "/#pricing"],
            ["Stats", "/stats/"],
            ["Get started", "/docs/"],
            ["Docs", "/docs/"],
            ["Install", "/#install"],
            ["x402 (opens in a new tab)", "https://x402.org"],
            ["pay.sh (opens in a new tab)", "https://pay.sh"],
            ["Terms", "/terms/"],
            ["Privacy", "/privacy/"],
        ]);
    });

    it("opens GitHub, x402 and X in a new tab without a referrer", () => {
        render(<SiteFooter />);
        const outside = ["GitHub", "x402", "X"].map((name) => `${name} (opens in a new tab)`);
        for (const name of outside) {
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

    it("heads each link column and fills the shorter ones to the longest with hidden cells", () => {
        render(<SiteFooter />);
        const nav = within(footer()).getByRole("navigation", { name: "Footer" });
        const headings = within(nav).getAllByRole("heading", { level: 2 });
        expect(headings.map((h) => h.textContent)).toEqual(["Site", "Developers", "Legal"]);
        for (const list of nav.querySelectorAll("ul")) {
            expect(list.children).toHaveLength(5);
            for (const filler of [...list.children].filter((li) => !li.querySelector("a"))) {
                expect(filler.getAttribute("aria-hidden")).toBe("true");
                expect(filler.className.split(" ")).toContain("phone:hidden");
            }
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
