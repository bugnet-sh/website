import type { Nodes, Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { readDoc } from "./doc-file";
import { docHref, type Doc } from "./docs";
import { headingIds, headingText } from "./heading-ids";
import { callouts } from "./parts";
import type { SearchEntry } from "./search";

// Inline content runs together; anything else is a block, so its parts are kept apart by a space
const INLINE = new Set([
    "paragraph",
    "heading",
    "emphasis",
    "strong",
    "delete",
    "link",
    "tableCell",
]);

function plainText(node: Nodes): string {
    // A diagram's source is markup, not words a reader searches for
    if (node.type === "code" && node.lang === "mermaid") return "";
    if ("value" in node) return node.value;
    if (!("children" in node)) return "";
    return node.children.map(plainText).join(INLINE.has(node.type) ? "" : " ");
}

/** A page's lead (its text before the first h2 or h3) and each h2 or h3 section. */
function sectionsOf(doc: Doc, body: string): SearchEntry[] {
    // A callout's `[!NOTE]` marker is syntax, not words a reader searches for
    const processor = unified().use(remarkParse).use(remarkGfm).use(headingIds).use(callouts);
    const tree = processor.runSync(processor.parse(body)) as Root;
    const page = docHref(doc);
    const lead: SearchEntry = { page, title: doc.title, heading: doc.title, id: "", text: "" };
    const entries = [lead];
    const texts: string[][] = [[]];
    let h2: string | undefined;
    for (const node of tree.children) {
        const id = node.type === "heading" ? String(node.data?.hProperties?.id) : "";
        if (node.type === "heading" && node.depth === 1) {
            lead.id = id;
        } else if (node.type === "heading" && (node.depth === 2 || node.depth === 3)) {
            const heading = headingText(node);
            const entry: SearchEntry = { page, title: doc.title, heading, id, text: "" };
            // Two steps can hold h3s of the same name, so an h3 names the h2 it sits under
            if (node.depth === 2) h2 = heading;
            else if (h2) entry.section = h2;
            entries.push(entry);
            texts.push([]);
        } else {
            texts.at(-1)?.push(plainText(node));
        }
    }
    entries.forEach((entry, i) => {
        entry.text = (texts[i] ?? []).join(" ").replace(/\s+/g, " ").trim();
    });
    return entries;
}

/** The search index over the docs, as the browser fetches it from `/search-index.json`. */
export function buildSearchIndex(list: readonly Doc[], dir?: string): SearchEntry[] {
    return list.flatMap((doc) => sectionsOf(doc, readDoc(doc, dir).body));
}
