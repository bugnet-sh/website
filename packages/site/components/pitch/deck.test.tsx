import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { stepFor } from "./deck";
import { PitchSlides } from "./slides";

afterEach(cleanup);

describe("stepFor", () => {
    it("moves forward and back with the keys a clicker sends", () => {
        for (const key of ["ArrowRight", "ArrowDown", "PageDown"])
            expect(stepFor(key, false)).toBe(1);
        for (const key of ["ArrowLeft", "ArrowUp", "PageUp"]) expect(stepFor(key, false)).toBe(-1);
        expect(stepFor(" ", false)).toBe(1);
        expect(stepFor(" ", true)).toBe(-1);
        expect(stepFor("Home", false)).toBe(-Infinity);
        expect(stepFor("End", false)).toBe(Infinity);
        expect(stepFor("a", false)).toBe(0);
    });
});

describe("PitchSlides", () => {
    it("numbers 13 slides, one H1 on the first and a title on every middle one", () => {
        const { container } = render(<PitchSlides />);
        const slides = [...container.querySelectorAll("[data-slide]")];
        expect(slides).toHaveLength(13);
        expect(container.querySelectorAll("h1")).toHaveLength(1);
        expect(slides.slice(1, -1).every((s) => s.querySelector("h2"))).toBe(true);
    });

    it("has no middle dot and links only to the support address", () => {
        const { container } = render(<PitchSlides />);
        expect(container.textContent).not.toContain("·");
        const links = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
        expect(links).toEqual(["mailto:support@bugnet.org"]);
    });
});
