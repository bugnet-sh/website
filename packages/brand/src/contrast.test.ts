import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    checkContrast,
    contrastPairs,
    contrastRatio,
    readTokens,
    resolveColour,
} from "./contrast.ts";

const css = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");

describe("contrastRatio", () => {
    it("is 21 for black on white", () => {
        expect(contrastRatio("#000000", "#FFFFFF")).toBe(21);
    });

    it("matches the known WCAG value for #777777 on white", () => {
        const ratio = contrastRatio("#777777", "#FFFFFF");
        expect(ratio).toBeGreaterThan(4.47);
        expect(ratio).toBeLessThan(4.49);
    });

    it("does not depend on argument order", () => {
        expect(contrastRatio("#FFFFFF", "#777777")).toBe(contrastRatio("#777777", "#FFFFFF"));
    });
});

describe("readTokens", () => {
    it("reads the custom properties of tokens.css", () => {
        expect(readTokens(css)["--bg"]).toBe("#0A0A0A");
    });
});

describe("checkContrast", () => {
    it("finds no failing pair in tokens.css", () => {
        expect(checkContrast(readTokens(css))).toEqual([]);
    });

    it("reports a chart wash too faint to read on the background", () => {
        const faint = "color-mix(in srgb, var(--accent-2) 28%, transparent)";
        const failing = checkContrast({ ...readTokens(css), "--chart-profit": faint });
        expect(failing).toContainEqual(
            expect.objectContaining({ fg: "--chart-profit", bg: "--bg" }),
        );
    });

    it("reports a pair below 4.5", () => {
        const failing = checkContrast({ ...readTokens(css), "--text-muted": "#333333" });
        expect(failing.map((pair) => pair.fg)).toContain("--text-muted");
        expect(failing[0]?.ratio).toBeLessThan(4.5);
    });
});

describe("contrastPairs", () => {
    it("covers every text colour on every surface", () => {
        const inks = ["--text", "--text-muted", "--accent", "--accent-2", "--accent-3", "--bad"];
        for (const fg of [...inks, "--warn"]) {
            for (const bg of ["--bg", "--surface", "--surface-hover"]) {
                expect(contrastPairs).toContainEqual([fg, bg]);
            }
        }
    });

    it("covers every chart fill on every surface", () => {
        for (const fg of ["--chart-profit", "--chart-loss"]) {
            for (const bg of ["--bg", "--surface", "--surface-hover"]) {
                expect(contrastPairs).toContainEqual([fg, bg]);
            }
        }
    });

    it("covers each accent's ink on its accent", () => {
        expect(contrastPairs).toContainEqual(["--accent-ink", "--accent"]);
        expect(contrastPairs).toContainEqual(["--accent-3-ink", "--accent-3"]);
    });
});

describe("resolveColour", () => {
    const tokens = {
        "--white": "#FFFFFF",
        "--black": "#000000",
        "--alias": "var(--white)",
        "--half": "color-mix(in srgb, var(--white) 50%, transparent)",
        "--odd": "rgb(1 2 3)",
    };

    it("returns a hex token as it is", () => {
        expect(resolveColour(tokens, "--white", "--black")).toBe("#FFFFFF");
    });

    it("follows a var() alias", () => {
        expect(resolveColour(tokens, "--alias", "--black")).toBe("#FFFFFF");
    });

    it("composites a color-mix wash over the surface it sits on", () => {
        expect(resolveColour(tokens, "--half", "--black")).toBe("#808080");
        expect(resolveColour(tokens, "--half", "--white")).toBe("#FFFFFF");
    });

    it("refuses a colour form it cannot measure", () => {
        expect(() => resolveColour(tokens, "--odd", "--black")).toThrow(/--odd/);
        expect(() => resolveColour(tokens, "--missing", "--black")).toThrow(/--missing/);
    });
});
