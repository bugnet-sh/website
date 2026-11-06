// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { el, svgEl } from "./dom.js";

describe("el", () => {
    it("sets text as text, never markup", () => {
        const p = el(document, "p", { text: "<b>x</b>" });
        expect(p.children).toHaveLength(0);
        expect(p.textContent).toBe("<b>x</b>");
    });

    it("refuses style and on* attributes", () => {
        expect(() => el(document, "p", { attrs: { style: "x" } })).toThrow();
        expect(() => el(document, "p", { attrs: { onclick: "x" } })).toThrow();
        expect(() => svgEl(document, "svg", { onload: "x" })).toThrow();
    });

    it("builds nested svg and html", () => {
        const svg = svgEl(document, "svg", { viewBox: "0 0 1 1" }, [
            svgEl(document, "circle", { r: "1" }),
        ]);
        expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
        const div = el(document, "div", { class: "a" }, [svg as unknown as Node]);
        expect(div.className).toBe("a");
        expect(div.querySelector("circle")).not.toBeNull();
    });
});
