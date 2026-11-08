import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Safety } from "./safety";

afterEach(cleanup);

it("heads the band in two tones, the muted line saying what the cells don't", () => {
    render(<Safety />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toBe(
        "Untrusted code stays in the sandbox. Run code you wouldn't trust on your own laptop.",
    );
    expect(screen.getByRole("region", { name: heading.textContent ?? "" })).toBeTruthy();
    const muted = heading.querySelector("span");
    expect(muted?.textContent).toBe("Run code you wouldn't trust on your own laptop.");
    expect(muted?.className).toContain("text-text-muted");
});

it("links to the docs' Safety page and nowhere else", () => {
    render(<Safety />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]?.textContent).toBe("Safety");
    expect(links[0]?.getAttribute("href")).toBe("/docs/safety/");
});

it("shows three facts from the docs, each over a drawing kept from screen readers", () => {
    render(<Safety />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(
        items.map((item) => within(item).getByRole("heading", { level: 3 }).textContent),
    ).toEqual(["Runs on a cloud machine", "Deleted at the deadline", "Output comes back as data"]);
    expect(items.map((item) => item.querySelector("p")?.textContent)).toEqual([
        "It can't reach your files, your keys or your local network.",
        "Everything in it goes too, so download what you need before then.",
        "Bugnet strips escape codes and hidden characters, and keeps the last 8 KiB of each stream.",
    ]);
    for (const item of items) {
        const art = item.querySelector("svg");
        expect(art?.getAttribute("aria-hidden")).toBe("true");
        expect(art?.getAttribute("focusable")).toBe("false");
    }
});

it("never uses the middle dot", () => {
    const { container } = render(<Safety />);
    expect(container.textContent).not.toContain("·");
});
