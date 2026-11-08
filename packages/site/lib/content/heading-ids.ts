import GithubSlugger from "github-slugger";
import type { Heading, Nodes, Root } from "mdast";

// terms.md and privacy.md fix their anchors this way, since other pages link to them
const EXPLICIT_ID = /\s*\{#([\w-]+)\}\s*$/;

/** A heading's plain text, as a reader sees it: no markup, no `{#id}`. */
export function headingText(node: Nodes): string {
    if ("value" in node) return node.value;
    if ("children" in node) return node.children.map(headingText).join("");
    return "";
}

/** Strips a trailing `{#id}` from the heading's last text and returns the id. */
function takeExplicitId(heading: Heading): string | undefined {
    const last = heading.children.at(-1);
    if (last?.type !== "text") return undefined;
    const match = EXPLICIT_ID.exec(last.value);
    if (!match) return undefined;
    last.value = last.value.slice(0, match.index);
    if (last.value === "") heading.children.pop();
    return match[1];
}

function* walkHeadings(node: Nodes): Generator<Heading> {
    if (node.type === "heading") yield node;
    else if ("children" in node) for (const child of node.children) yield* walkHeadings(child);
}

/**
 * A remark plugin that gives every heading an id: its `{#id}` suffix if it has one, else the
 * GitHub slug of its text, numbered when a page repeats it.
 */
export function headingIds() {
    return (tree: Root) => {
        const slugger = new GithubSlugger();
        const headings = [...walkHeadings(tree)];
        // Explicit ids are reserved first, so a slug earlier in the page never takes one
        const explicit = headings.map(takeExplicitId);
        for (const id of explicit) if (id) slugger.slug(id);
        headings.forEach((heading, i) => {
            const id = explicit[i] ?? slugger.slug(headingText(heading));
            heading.data = { ...heading.data, hProperties: { ...heading.data?.hProperties, id } };
        });
    };
}
