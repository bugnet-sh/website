import { describe, expect, it } from "vitest";
import { search, type SearchEntry } from "./search";

const entry = (title: string, heading: string, text = ""): SearchEntry => ({
    page: `/docs/${title.toLowerCase()}/`,
    title,
    heading,
    id: heading.toLowerCase(),
    text,
});

describe("search", () => {
    it("puts a title hit before a heading hit before a text hit, case-insensitively", () => {
        const entries = [
            entry("Tools", "Run", "Each run is paying for itself."),
            entry("Limits", "Paying more"),
            entry("Paying", "Paying"),
        ];
        expect(search(entries, "PAYING").map((e) => e.title)).toEqual([
            "Paying",
            "Limits",
            "Tools",
        ]);
    });

    it("returns 8 results at most and none for a blank query", () => {
        const entries = Array.from({ length: 12 }, (_, i) => entry(`Page${i}`, "Run"));
        expect(search(entries, "run")).toHaveLength(8);
        expect(search(entries, "  ")).toEqual([]);
    });
});
