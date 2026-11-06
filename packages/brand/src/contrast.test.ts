import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkContrast, contrastPairs, contrastRatio, readTokens } from "./contrast.ts";

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

    it("reports a pair below 4.5", () => {
        const failing = checkContrast({ ...readTokens(css), "--text-muted": "#333333" });
        expect(failing.map((pair) => pair.fg)).toContain("--text-muted");
        expect(failing[0]?.ratio).toBeLessThan(4.5);
    });
});

describe("contrastPairs", () => {
    it("covers every text colour on every surface", () => {
        for (const fg of ["--text", "--text-muted", "--accent", "--accent-2", "--bad", "--warn"]) {
            for (const bg of ["--bg", "--surface", "--surface-hover"]) {
                expect(contrastPairs).toContainEqual([fg, bg]);
            }
        }
    });

    it("covers the accent ink on the accent", () => {
        expect(contrastPairs).toContainEqual(["--accent-ink", "--accent"]);
    });
});
