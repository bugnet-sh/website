import type { Code, List, Root, RootContent } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { headingText } from "../content/heading-ids";
import { clients, type ClientId } from "./clients";

const ID = /\{#([\w-]+)\}\s*$/;

/** A client's first code block, or, for one set up by clicking through, its steps as Markdown. */
export type ClientLines = { id: ClientId; name: string } & (
    { code: string; lang: string | undefined } | { steps: string }
);

/** The client sections of the docs' Install page, each the nodes under its `### … {#id}`. */
function sections(tree: Root): Map<string, RootContent[]> {
    const found = new Map<string, RootContent[]>();
    let current: RootContent[] | undefined;
    for (const node of tree.children) {
        if (node.type === "heading" && node.depth <= 3) {
            const id = node.depth === 3 ? ID.exec(headingText(node))?.[1] : undefined;
            current = undefined;
            if (id) found.set(id, (current = []));
            continue;
        }
        current?.push(node);
    }
    return found;
}

/**
 * The landing page's install lines, read from the docs' Install page so both show the same
 * strings. A client without a section fails the build rather than showing an empty tab.
 */
export function installLines(markdown: string): { hero: string; clients: ClientLines[] } {
    const found = sections(unified().use(remarkParse).use(remarkGfm).parse(markdown));
    const lines = clients.map(({ id, name }): ClientLines => {
        const nodes = found.get(id);
        if (!nodes) throw new Error(`install.md has no section {#${id}}`);
        const code = nodes.find((n): n is Code => n.type === "code");
        if (code) return { id, name, code: code.value, lang: code.lang ?? undefined };
        const list = nodes.find((n): n is List => n.type === "list");
        const [start, end] = [list?.position?.start.offset, list?.position?.end.offset];
        if (start === undefined || end === undefined) {
            throw new Error(`install.md: {#${id}} has no code block and no steps`);
        }
        return { id, name, steps: markdown.slice(start, end) };
    });
    // One command a reader can paste whole: the plugin's block holds two alternative installs
    const hero = (found.get("claude-code") ?? [])
        .filter((n): n is Code => n.type === "code")
        .find((n) => !n.value.includes("\n"));
    if (!hero) throw new Error("install.md: Claude Code has no one-line install");
    return { hero: hero.value, clients: lines };
}
