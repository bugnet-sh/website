import { describe, expect, it } from "vitest";
import { tocOf } from "./toc";

describe("tocOf", () => {
    it("lists h2 and h3 in order with the ids the article renders", () => {
        const source = [
            "Last updated: 7 November 2026",
            "",
            "# Terms {#terms}",
            "",
            "## The short version {#summary}",
            "",
            "Text.",
            "",
            "### Packages",
            "",
            "#### Too deep",
            "",
            "## Packages",
        ].join("\n");
        expect(tocOf(source)).toEqual([
            { id: "summary", text: "The short version", depth: 2 },
            { id: "packages", text: "Packages", depth: 3 },
            { id: "packages-1", text: "Packages", depth: 2 },
        ]);
    });

    it("skips a heading inside a code block", () => {
        expect(tocOf("```md\n## Not a heading\n```\n\n## Real")).toEqual([
            { id: "real", text: "Real", depth: 2 },
        ]);
    });
});
