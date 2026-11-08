import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { github } from "../shell/links";
import { Contact } from "./contact";

afterEach(cleanup);

describe("Contact", () => {
    it("emails support from the big Contact us, then links the docs and GitHub", () => {
        render(<Contact />);
        const links = screen.getAllByRole("link");
        expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
            ["Contact us", "mailto:support@bugnet.org"],
            ["Read the docs", "/docs/"],
            ["GitHub (opens in a new tab)", "https://github.com/bugnet-sh/bugnet"],
        ]);
        expect(screen.getByRole("heading", { level: 2, name: "Contact us" })).toBeTruthy();
    });

    it("opens GitHub in a new tab without a referrer, at the footer's address", () => {
        render(<Contact />);
        const link = screen.getByRole("link", { name: "GitHub (opens in a new tab)" });
        expect(link.getAttribute("href")).toBe(github.href);
        expect(link.getAttribute("target")).toBe("_blank");
        expect(link.getAttribute("rel")).toBe("noreferrer");
        expect(screen.getByRole("link", { name: "Read the docs" }).getAttribute("target")).toBe(
            null,
        );
    });
});
