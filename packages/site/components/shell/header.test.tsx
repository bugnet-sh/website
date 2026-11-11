import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SiteHeader } from "./header";

afterEach(cleanup);

function menuButton() {
    return screen.getByRole("button", { name: "Menu" });
}

function panelOf(button: HTMLElement) {
    const panel = document.getElementById(button.getAttribute("aria-controls") ?? "");
    expect(panel).not.toBeNull();
    return panel as HTMLElement;
}

describe("SiteHeader", () => {
    it("links Home, Cloud, Docs and GitHub, which opens in a new tab", () => {
        render(<SiteHeader />);
        const banner = screen.getByRole("banner");
        expect(within(banner).getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/");
        expect(within(banner).getByRole("link", { name: "Cloud" }).getAttribute("href")).toBe(
            "/cloud/",
        );
        expect(within(banner).getByRole("link", { name: "Docs" }).getAttribute("href")).toBe(
            "/docs/",
        );
        const github = within(banner).getByRole("link", { name: "GitHub (opens in a new tab)" });
        expect(github.getAttribute("href")).toBe("https://github.com/bugnet-sh/bugnet");
        expect(github.getAttribute("target")).toBe("_blank");
        expect(github.getAttribute("rel")).toBe("noreferrer");
    });

    it("links the logo home by its name", () => {
        render(<SiteHeader />);
        expect(screen.getByRole("link", { name: "Bugnet" }).getAttribute("href")).toBe("/");
    });

    it("marks only the current page's link", () => {
        render(<SiteHeader current="docs" />);
        expect(screen.getByRole("link", { name: "Docs" }).getAttribute("aria-current")).toBe(
            "page",
        );
        expect(screen.getByRole("link", { name: "Home" }).hasAttribute("aria-current")).toBe(false);
    });

    it("marks Cloud on the cloud page", () => {
        render(<SiteHeader current="cloud" />);
        const marked = screen.getAllByRole("link").filter((l) => l.hasAttribute("aria-current"));
        expect(marked.map((l) => [l.textContent, l.getAttribute("aria-current")])).toEqual([
            ["Cloud", "page"],
        ]);
    });

    it("marks no link on a page the header does not list", () => {
        render(<SiteHeader />);
        expect(document.querySelectorAll("[aria-current]")).toHaveLength(0);
    });

    it("is one sticky band, --nav tall with its hairline drawn inside that height", () => {
        render(<SiteHeader />);
        const banner = screen.getByRole("banner");
        const classes = banner.className.split(" ");
        expect(classes).toEqual(
            expect.arrayContaining([
                "sticky",
                "top-0",
                "bg-bg",
                "shadow-[inset_0_calc(var(--hairline)*-1)_0_var(--line)]",
            ]),
        );
        // A border would add a pixel below the row and make the band 63 px
        expect(classes.some((c) => c.startsWith("border"))).toBe(false);
        expect(banner.firstElementChild?.className.split(" ")).toContain("h-(--nav)");
    });

    it("hangs the phone menu straight under the band, which already holds the hairline", () => {
        render(<SiteHeader />);
        const classes = panelOf(menuButton()).className.split(" ");
        expect(classes).toEqual(expect.arrayContaining(["absolute", "top-full"]));
        expect(classes).not.toContain("mt-(--hairline)");
    });

    it("folds the links away on phones, where the Menu button shows instead", () => {
        render(<SiteHeader />);
        const nav = screen.getByRole("navigation", { name: "Main" });
        expect(nav.className.split(" ")).toContain("phone:hidden");
        expect(menuButton().className.split(" ")).toEqual(
            expect.arrayContaining(["hidden", "phone:flex"]),
        );
    });

    it("sends Get Started to the tutorial", () => {
        render(<SiteHeader />);
        expect(screen.getByRole("link", { name: "Get Started" }).getAttribute("href")).toBe(
            "/docs/",
        );
    });
});

describe("the phone menu", () => {
    it("starts closed, with the button naming the panel it controls", () => {
        render(<SiteHeader />);
        const button = menuButton();
        expect(button.getAttribute("aria-expanded")).toBe("false");
        expect(panelOf(button).hidden).toBe(true);
    });

    it("opens on a click, showing the four links, and closes on a second click", () => {
        render(<SiteHeader current="home" />);
        const button = menuButton();
        fireEvent.click(button);
        expect(button.getAttribute("aria-expanded")).toBe("true");
        const panel = panelOf(button);
        expect(panel.hidden).toBe(false);
        const links = within(panel).getAllByRole("link");
        expect(links.map((l) => l.textContent)).toEqual([
            "Home",
            "Cloud",
            "Docs",
            "GitHub (opens in a new tab)",
        ]);
        expect(links[0]?.getAttribute("aria-current")).toBe("page");
        fireEvent.click(button);
        expect(button.getAttribute("aria-expanded")).toBe("false");
        expect(panel.hidden).toBe(true);
    });

    it("closes on Escape and returns focus to the button", () => {
        render(<SiteHeader />);
        const button = menuButton();
        fireEvent.click(button);
        const docs = within(panelOf(button)).getByRole("link", { name: "Docs" });
        act(() => docs.focus());
        fireEvent.keyDown(docs, { key: "Escape" });
        expect(button.getAttribute("aria-expanded")).toBe("false");
        expect(document.activeElement).toBe(button);
    });

    it("closes when a link is chosen and returns focus to the button", () => {
        render(<SiteHeader />);
        const button = menuButton();
        fireEvent.click(button);
        // jsdom cannot follow a link; the menu closes on the click either way
        document.addEventListener("click", (event) => event.preventDefault(), { once: true });
        fireEvent.click(within(panelOf(button)).getByRole("link", { name: "Docs" }));
        expect(button.getAttribute("aria-expanded")).toBe("false");
        expect(document.activeElement).toBe(button);
    });

    it("closes when Tab moves focus past the last link, without pulling focus back", () => {
        render(<SiteHeader />);
        const button = menuButton();
        fireEvent.click(button);
        const panel = panelOf(button);
        const last = within(panel).getAllByRole("link").at(-1) as HTMLElement;
        const next = screen.getByRole("link", { name: "Get Started" });
        // A real focus change outside act would leave React's update unflushed at the assertion
        act(() => last.focus());
        act(() => next.focus());
        expect(button.getAttribute("aria-expanded")).toBe("false");
        expect(document.activeElement).toBe(next);
    });

    it("closes on a tap outside the menu, and stays open on a tap inside the panel", () => {
        render(<SiteHeader />);
        const button = menuButton();
        fireEvent.click(button);
        fireEvent.pointerDown(panelOf(button));
        expect(button.getAttribute("aria-expanded")).toBe("true");
        fireEvent.pointerDown(document.body);
        expect(button.getAttribute("aria-expanded")).toBe("false");
    });

    it("stays open while focus moves back from the first link to the button", () => {
        render(<SiteHeader />);
        const button = menuButton();
        fireEvent.click(button);
        act(() => within(panelOf(button)).getAllByRole("link")[0]?.focus());
        act(() => button.focus());
        expect(button.getAttribute("aria-expanded")).toBe("true");
    });
});
