import type { Nodes, Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { readDoc } from "./doc-file";
import { docHref, type Doc } from "./docs";
import { headingText } from "./heading-ids";
import { isExternal, siteHref } from "./href";

export const siteOrigin = "https://bugnet.sh";

const EXPLICIT_ID = /[ \t]*\{#[\w-]+\}[ \t]*$/;
const SCHEME = /^[a-z][a-z\d+.-]*:/i;

type Edit = { start: number; end: number; text: string };

/** Where a docs page's Markdown is served: `/docs/index.md` for Get started. */
export function docMarkdownPath(doc: Doc): string {
    return `/docs/${doc.slug || "index"}.md`;
}

function* walk(node: Nodes): Generator<Nodes> {
    yield node;
    if ("children" in node) for (const child of node.children) yield* walk(child);
}

function offsets(node: Nodes, file: string): [number, number] {
    const [start, end] = [node.position?.start.offset, node.position?.end.offset];
    if (start === undefined || end === undefined)
        throw new Error(`${file}: a node has no position`);
    return [start, end];
}

/**
 * A docs page as Markdown for an agent to read: its title and address first, then its body with
 * no `{#id}` on the headings and every link into the site made absolute. Everything else,
 * Mermaid fences included, is the source byte for byte.
 */
export function cleanMarkdown(doc: Doc, body: string): string {
    const page = `${siteOrigin}${docHref(doc)}`;
    const tree = unified().use(remarkParse).use(remarkGfm).parse(body) as Root;
    const [title, next] = tree.children;
    if (title?.type !== "heading" || title.depth !== 1) {
        throw new Error(`${doc.file}: the body does not open with its title`);
    }
    if (headingText(title).replace(EXPLICIT_ID, "") !== doc.title) {
        throw new Error(`${doc.file}: the first heading is not "${doc.title}"`);
    }
    const from = next ? offsets(next, doc.file)[0] : body.length;
    const edits: Edit[] = [];
    for (const node of tree.children.slice(1).flatMap((child) => [...walk(child)])) {
        const [start, end] = offsets(node, doc.file);
        const source = body.slice(start, end);
        if (node.type === "heading") {
            const id = EXPLICIT_ID.exec(source);
            if (id) edits.push({ start: start + id.index, end, text: "" });
        } else if (node.type === "link" || node.type === "image" || node.type === "definition") {
            const url = node.url;
            if (isExternal(url) || SCHEME.test(url) || url.startsWith("//")) continue;
            // A destination is written last, so the final "](" or "]: " before it is its own
            const at = Math.max(source.lastIndexOf(`](${url}`), source.lastIndexOf(`]: ${url}`));
            if (at < 0) throw new Error(`${doc.file}: cannot find the link ${url}`);
            const urlStart = start + at + 2 + (source[at + 1] === ":" ? 1 : 0);
            edits.push({
                start: urlStart,
                end: urlStart + url.length,
                text: new URL(siteHref(url), page).href,
            });
        }
    }
    let rest = body;
    for (const { start, end, text } of edits.sort((a, b) => b.start - a.start)) {
        rest = rest.slice(0, start) + text + rest.slice(end);
    }
    return `# ${doc.title}\n\nSource: ${page}\n\n${rest.slice(from).trimEnd()}\n`;
}

/** A docs file as clean Markdown: its front matter left out, the rest as `cleanMarkdown` has it. */
export function docMarkdown(doc: Doc, dir?: string): string {
    return cleanMarkdown(doc, readDoc(doc, dir).body);
}
