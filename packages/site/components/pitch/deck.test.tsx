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

    it("ignores a long momentum tail, spikes included, until the wheel goes quiet", () => {
        const wheel = wheelPager();
        const tail = Array.from({ length: 100 }, (_, i) => (i === 60 ? 40 : Math.max(1, 60 - i)));
        const steps = tail.map((d, i) => wheel(d, i * 16)).filter((s) => s !== 0);
        expect(steps).toEqual([1]);
        expect(wheel(60, 100 * 16 + 400)).toBe(1);
    });

    // A trackpad swipe: fingers speed up, then macOS sends momentum that fades over about a second
    function swipe(start: number, sign = 1, cutAt = Infinity) {
        const rise = [6, 14, 26, 40, 52];
        const fade = Array.from({ length: 80 }, (_, i) =>
            Math.max(1, Math.round(52 * 0.95 ** (i + 1))),
        );
        return [...rise, ...fade]
            .map((d, i) => ({ d: d * sign, t: start + i * 16 }))
            .filter((e) => e.t < start + cutAt);
    }
    const run = (events: { d: number; t: number }[]) => {
        const wheel = wheelPager();
        return events.map((e) => wheel(e.d, e.t)).filter((s) => s !== 0);
    };

    it("steps again for a second swipe that starts while the first one's momentum is still coming in", () => {
        expect(run([...swipe(0, 1, 600), ...swipe(690)])).toEqual([1, 1]);
    });

    it("steps back for a swipe the other way during momentum", () => {
        expect(run([...swipe(0, 1, 600), ...swipe(660, -1)])).toEqual([1, -1]);
    });

    it("takes one step for a long swipe that keeps speeding up", () => {
        const rise = Array.from({ length: 12 }, (_, i) => 5 * (i + 1));
        const fade = Array.from({ length: 60 }, (_, i) =>
            Math.max(1, Math.round(60 * 0.94 ** (i + 1))),
        );
        expect(run([...rise, ...fade].map((d, i) => ({ d, t: i * 16 })))).toEqual([1]);
    });

    it("takes one step for momentum that jitters up and down as it fades", () => {
        const jitter = [0.85, 1, 1.15, 0.9, 1.2];
        const fade = Array.from({ length: 90 }, (_, i) =>
            Math.max(1, 60 * 0.96 ** i * (jitter[i % 5] ?? 1)),
        );
        expect(run(fade.map((d, i) => ({ d, t: i * 16 })))).toEqual([1]);
    });
});

describe("pitchSlides", () => {
    it("numbers 16 slides, with one H1 on the first and a title on every middle one", () => {
        const { container } = render(<>{pitchSlides()}</>);
        const slides = [...container.querySelectorAll("[data-slide]")];
        expect(slides).toHaveLength(16);
        expect(container.querySelectorAll("h1")).toHaveLength(1);
        expect(slides.slice(1, -1).every((s) => s.querySelector("h2"))).toBe(true);
    });

    it("has no middle dot and links only to the founder's site and the support address", () => {
        const { container } = render(<>{pitchSlides()}</>);
        expect(container.textContent).not.toContain("·");
        const links = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
        expect(links).toEqual(["https://oynozan.com", "mailto:support@bugnet.org"]);
    });
});
