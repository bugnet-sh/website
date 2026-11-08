import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Band, Frame } from "./frame";

afterEach(cleanup);

function classes(el: Element | null | undefined) {
    return (el?.className ?? "").split(" ");
}

describe("Band", () => {
    it("is a full-width element with a hairline under it and a frame inside", () => {
        const { container } = render(
            <Band as="section" className="extra">
                <p>content</p>
            </Band>,
        );
        const band = container.firstElementChild;
        expect(band?.tagName).toBe("SECTION");
        expect(classes(band)).toEqual(
            expect.arrayContaining(["border-b-(length:--hairline)", "border-line", "extra"]),
        );
        const frame = band?.firstElementChild;
        expect(classes(frame)).toContain("max-w-(--frame)");
        expect(frame?.querySelector("p")?.textContent).toBe("content");
    });

    it("takes an id that other pages link to, clear of the sticky header", () => {
        const { container } = render(<Band id="limits">x</Band>);
        const band = container.firstElementChild;
        expect(band?.id).toBe("limits");
        expect(classes(band)).toContain("scroll-mt-(--nav)");
    });

    it("places its children directly when it builds no rail", () => {
        const { container } = render(
            <Band as="div" rail={false}>
                <p>content</p>
            </Band>,
        );
        expect(container.firstElementChild?.firstElementChild?.tagName).toBe("P");
    });
});

describe("Frame", () => {
    it("is centred, frame wide, with a hairline rail each side, padded inline", () => {
        const { container } = render(<Frame className="extra">x</Frame>);
        expect(classes(container.firstElementChild)).toEqual(
            expect.arrayContaining([
                "mx-auto",
                "max-w-(--frame)",
                "border-x-(length:--hairline)",
                "border-line",
                "px-(--pad)",
                "extra",
            ]),
        );
    });

    it("drops its rails on phones, where the frame is the full width", () => {
        const { container } = render(<Frame>x</Frame>);
        expect(classes(container.firstElementChild)).toContain("phone:border-x-0");
    });

    it("leaves out the padding when asked, for content that spans rail to rail", () => {
        const { container } = render(<Frame padded={false}>x</Frame>);
        expect(container.firstElementChild?.className).not.toContain("px-");
    });
});
