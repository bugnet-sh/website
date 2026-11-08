import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stepFor, wheelPager } from "./deck";
import { pitchSlides } from "./slides";

// The cover's drawing watches matchMedia and IntersectionObserver, which jsdom does not have
beforeEach(() => {
    vi.stubGlobal("matchMedia", () => ({
        matches: true,
        addEventListener() {},
        removeEventListener() {},
    }));
    vi.stubGlobal(
        "IntersectionObserver",
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("stepFor", () => {
    it("moves forward and back with the keys a clicker sends", () => {
        for (const key of ["ArrowRight", "ArrowDown", "PageDown"]) {
            expect(stepFor(key, false)).toBe(1);
        }
        for (const key of ["ArrowLeft", "ArrowUp", "PageUp"]) expect(stepFor(key, false)).toBe(-1);
        expect(stepFor(" ", false)).toBe(1);
        expect(stepFor(" ", true)).toBe(-1);
        expect(stepFor("Home", false)).toBe(-Infinity);
        expect(stepFor("End", false)).toBe(Infinity);
        expect(stepFor("a", false)).toBe(0);
    });
});

describe("wheelPager", () => {
    it("takes one step for a whole trackpad swipe and its momentum", () => {
        const wheel = wheelPager();
        const steps = [4, 18, 40, 60, 45, 30, 20, 12, 8, 4, 2, 1].map((d, i) => wheel(d, i * 16));
        expect(steps.filter((s) => s !== 0)).toEqual([1]);
    });

    it("takes the next step after a pause, and steps back on an upward swipe", () => {
        const wheel = wheelPager();
        expect(wheel(60, 0)).toBe(1);
        expect(wheel(60, 1000)).toBe(1);
        expect(wheel(-60, 2000)).toBe(-1);
    });

    it("counts a sharp new swipe during the last one's momentum", () => {
        const wheel = wheelPager();
        expect(wheel(60, 0)).toBe(1);
        expect(wheel(6, 700)).toBe(0);
        expect(wheel(80, 716)).toBe(1);
    });
});

describe("pitchSlides", () => {
    it("numbers 15 slides, with one H1 on the first and a title on every middle one", () => {
        const { container } = render(<>{pitchSlides()}</>);
        const slides = [...container.querySelectorAll("[data-slide]")];
        expect(slides).toHaveLength(15);
        expect(container.querySelectorAll("h1")).toHaveLength(1);
        expect(slides.slice(1, -1).every((s) => s.querySelector("h2"))).toBe(true);
    });

    it("has no middle dot and links only to the support address", () => {
        const { container } = render(<>{pitchSlides()}</>);
        expect(container.textContent).not.toContain("·");
        const links = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
        expect(links).toEqual(["mailto:support@bugnet.org"]);
    });
});
