import { describe as suite, expect, it } from "vitest";
import { describe, pageMetadata } from "./meta";

suite("describe", () => {
    it("takes the first paragraph, without its Markdown", () => {
        const body =
            "# Title {#t}\n\nBugnet is `one` [server](/x/).\nIt speaks **HTTP**.\n\nSecond.";
        expect(describe(body)).toBe("Bugnet is one server. It speaks HTTP.");
    });

    it("cuts at a word boundary within 155 characters", () => {
        const out = describe(`# T\n\n${"word ".repeat(60)}`);
        expect(out.length).toBeLessThanOrEqual(155);
        expect(out.endsWith("word")).toBe(true);
    });
});

suite("pageMetadata", () => {
    it("sets the canonical path and the share card", () => {
        const meta = pageMetadata("/stats/", "Stats", "Live numbers from Bugnet.");
        expect(meta.alternates?.canonical).toBe("/stats/");
        expect(meta.twitter).toMatchObject({ card: "summary_large_image", site: "@bugnetsh" });
    });
});
