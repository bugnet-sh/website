import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Logo } from "./logo";

afterEach(cleanup);

const require = createRequire(import.meta.url);
const source = new DOMParser().parseFromString(
    readFileSync(require.resolve("@bugnet/brand/logo.svg"), "utf8"),
    "image/svg+xml",
);

/** Each drawn shape as its tag and the attributes that give its geometry. */
function shapes(svg: Element | Document | null) {
    return [...(svg?.querySelectorAll("path, circle") ?? [])].map((el) =>
        ["d", "cx", "cy", "r", "fill-rule", "stroke-width", "stroke-linecap", "fill"].map((name) =>
            el.getAttribute(name),
        ),
    );
}

describe("Logo", () => {
    it("draws the brand's logo.svg, shape for shape, in the current colour", () => {
        const { container } = render(<Logo />);
        const svg = container.querySelector("svg");
        expect(svg?.getAttribute("viewBox")).toBe(source.documentElement.getAttribute("viewBox"));
        expect(shapes(svg)).toEqual(shapes(source));
        expect(svg?.querySelector("g")?.getAttribute("fill")).toBe("currentColor");
    });

    it("shows the name beside the mark and hides the mark from assistive tech", () => {
        const { container } = render(<Logo />);
        expect(container.textContent).toBe("Bugnet");
        expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    });

    it("names the mark itself when it stands alone", () => {
        const { container } = render(<Logo withName={false} />);
        const svg = container.querySelector("svg");
        expect(container.textContent).toBe("");
        expect(svg?.getAttribute("role")).toBe("img");
        expect(svg?.getAttribute("aria-label")).toBe("Bugnet");
    });
});
