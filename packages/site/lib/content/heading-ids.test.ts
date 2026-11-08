import type { Heading, Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { headingIds, headingText } from "./heading-ids";

function headings(source: string): { id: unknown; text: string }[] {
    const processor = unified().use(remarkParse).use(remarkGfm).use(headingIds);
    const tree = processor.runSync(processor.parse(source)) as Root;
    return tree.children
        .filter((node): node is Heading => node.type === "heading")
        .map((node) => ({ id: node.data?.hProperties?.id, text: headingText(node) }));
}

describe("headingIds", () => {
    it("takes a trailing {#id} as the id and strips it from the text", () => {
        expect(headings("## The short version {#summary}")).toEqual([
            { id: "summary", text: "The short version" },
        ]);
    });

    it("gives a plain heading its github slug", () => {
        expect(headings("## Who pays, and when?")).toEqual([
            { id: "who-pays-and-when", text: "Who pays, and when?" },
        ]);
    });

    it("gives duplicate headings distinct ids", () => {
        expect(headings("## Logs\n\n## Logs\n\n### Logs").map((h) => h.id)).toEqual([
            "logs",
            "logs-1",
            "logs-2",
        ]);
    });

    it("never hands a slug an explicit id already took", () => {
        expect(headings("## Intro {#logs}\n\n## Logs").map((h) => h.id)).toEqual([
            "logs",
            "logs-1",
        ]);
    });

    it("reads text through inline code and links", () => {
        expect(headings("## The `sbx_` [handle](#handle) {#handle}")).toEqual([
            { id: "handle", text: "The sbx_ handle" },
        ]);
    });
});
