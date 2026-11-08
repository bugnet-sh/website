import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildSearchIndex } from "./search-index";

const fixtures = fileURLToPath(new URL("../../test/fixtures/docs", import.meta.url));

describe("buildSearchIndex", () => {
    it("indexes each page's lead and each h2 or h3 section, front matter left out", () => {
        const pages = [
            { title: "Install", slug: "", file: "install.md" },
            { title: "Paying", slug: "paying", file: "paying.md" },
        ];
        expect(buildSearchIndex(pages, fixtures)).toEqual([
            {
                page: "/docs/",
                title: "Install",
                heading: "Install",
                id: "install",
                text: "Add it.",
            },
            {
                page: "/docs/",
                title: "Install",
                heading: "Claude Code",
                id: "claude-code",
                text: "Run claude mcp add bugnet.",
            },
            { page: "/docs/paying/", title: "Paying", heading: "Paying", id: "paying", text: "" },
            {
                page: "/docs/paying/",
                title: "Paying",
                heading: "USDC",
                id: "usdc",
                text: "Pay in USDC. One line. Two line.",
            },
            { page: "/docs/paying/", title: "Paying", heading: "Refunds", id: "refunds", text: "" },
        ]);
    });
});
