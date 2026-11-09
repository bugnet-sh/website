import type {
    Code,
    Data,
    ListItem,
    Nodes,
    Paragraph,
    Parent,
    PhrasingContent,
    Root,
    RootContent,
} from "mdast";
import { headingText } from "./heading-ids";

/** Fences in a row that each name a tab, shown as one block with a tab per fence. */
export interface CodeTabsNode extends Parent {
    type: "codeTabs";
    children: Code[];
}

declare module "mdast" {
    interface RootContentMap {
        codeTabs: CodeTabsNode;
    }
    interface BlockContentMap {
        codeTabs: CodeTabsNode;
    }
}

type Properties = NonNullable<Data["hProperties"]>;

/** Adds HTML properties to a node, which the renderer reads off the element it becomes. */
export function mark(node: { data?: Data }, properties: Properties): void {
    node.data = { ...node.data, hProperties: { ...node.data?.hProperties, ...properties } };
}

function* parents(node: Nodes): Generator<Parent> {
    if (!("children" in node)) return;
    yield node;
    for (const child of node.children) yield* parents(child);
}

/** A remark plugin that marks the paragraph right under the title as the page's lead. */
export function lead() {
    return (tree: Root) => {
        const at = tree.children.findIndex((n) => n.type === "heading" && n.depth === 1);
        const next = at < 0 ? undefined : tree.children[at + 1];
        if (next?.type === "paragraph") mark(next, { dataLead: "" });
    };
}

export const calloutKinds = ["note", "tip", "warning", "money"] as const;
export type CalloutKind = (typeof calloutKinds)[number];

const CALLOUT = /^\[!(NOTE|TIP|WARNING|MONEY)\][ \t]*(?:\r?\n|$)/;
const LINE_START = /^\r?\n/;

/** The bold first line of a callout, taken out of its paragraph, or nothing if it has none. */
function takeTitle(first: Paragraph): PhrasingContent[] | undefined {
    const [bold, after] = first.children;
    if (bold?.type !== "strong") return undefined;
    const ends =
        after === undefined ||
        after.type === "break" ||
        (after.type === "text" && LINE_START.test(after.value));
    if (!ends) return undefined;
    first.children.shift();
    if (after?.type === "break") first.children.shift();
    if (after?.type === "text") {
        after.value = after.value.replace(LINE_START, "");
        if (after.value === "") first.children.shift();
    }
    return bold.children;
}

/**
 * A remark plugin for GitHub's alert syntax: a blockquote that opens with `[!NOTE]`, `[!TIP]`,
 * `[!WARNING]` or `[!MONEY]` becomes a callout of that kind, and a bold line right under the
 * marker its title. Any other blockquote stays a quote.
 */
export function callouts() {
    return (tree: Root) => {
        for (const quote of parents(tree)) {
            if (quote.type !== "blockquote") continue;
            const first = quote.children[0];
            const head = first?.type === "paragraph" ? first.children[0] : undefined;
            const match = head?.type === "text" ? CALLOUT.exec(head.value) : null;
            if (!match?.[1] || head?.type !== "text" || first?.type !== "paragraph") continue;
            head.value = head.value.slice(match[0].length);
            if (head.value === "") first.children.shift();
            const title = takeTitle(first);
            if (first.children.length === 0) quote.children.shift();
            if (title) {
                const line: Paragraph = { type: "paragraph", children: title };
                mark(line, { dataCalloutTitle: "" });
                quote.children.unshift(line);
            }
            mark(quote, { dataCallout: match[1].toLowerCase() });
        }
    };
}

const TAB = /(?:^|\s)tab="([^"]+)"/;

/** The tab a fence names in its info string, as in ```sh tab="Claude Code". */
export function tabOf(node: RootContent): string | undefined {
    return node.type === "code" ? TAB.exec(node.meta ?? "")?.[1] : undefined;
}

/**
 * A remark plugin that gathers two or more fences in a row, each naming a tab, into one tabbed
 * block. The fences stay as they are, so the Markdown reads the same without it.
 */
export function codeTabs() {
    return (tree: Root) => {
        for (const parent of [...parents(tree)]) {
            const out: RootContent[] = [];
            let run: Code[] = [];
            const flush = () => {
                if (run.length > 1) {
                    const tabs: CodeTabsNode = { type: "codeTabs", children: run };
                    mark(tabs, { dataCodeTabs: "" });
                    out.push(tabs);
                } else {
                    out.push(...run);
                }
                run = [];
            };
            for (const child of parent.children as RootContent[]) {
                const name = tabOf(child);
                if (child.type === "code" && name) {
                    mark(child, { dataTab: name });
                    run.push(child);
                } else {
                    flush();
                    out.push(child);
                }
            }
            flush();
            (parent as { children: RootContent[] }).children = out;
        }
    };
}

/** A card item: one paragraph, a link into the docs, then ": " and a sentence. */
function isCard(item: ListItem): boolean {
    const [paragraph, ...rest] = item.children;
    if (rest.length > 0 || paragraph?.type !== "paragraph") return false;
    const [link, text] = paragraph.children;
    return (
        link?.type === "link" &&
        link.url.startsWith("/docs/") &&
        text?.type === "text" &&
        text.value.startsWith(": ")
    );
}

/**
 * A remark plugin that marks the list right under an H2 titled "Next steps" as cards, when every
 * item is `[Title](/docs/…/): one sentence.`
 */
export function nextSteps() {
    return (tree: Root) => {
        tree.children.forEach((node, i) => {
            if (node.type !== "heading" || node.depth !== 2) return;
            if (
                headingText(node)
                    .replace(/\s*\{#[\w-]+\}\s*$/, "")
                    .trim() !== "Next steps"
            )
                return;
            const list = tree.children[i + 1];
            if (list?.type !== "list" || list.ordered || !list.children.every(isCard)) return;
            mark(list, { dataNextSteps: "" });
        });
    };
}

/** A clip's address: an MP4 under /docs/clips/, with its poster and WebM by the same name. */
export const CLIP = /^\/docs\/clips\/[\w-]+\.mp4$/;

/**
 * A remark plugin that lifts a clip, an image on a line of its own that points at an MP4 under
 * `/docs/clips/`, out of its paragraph, so it renders as a block rather than inside a `<p>`.
 */
export function clips() {
    return (tree: Root) => {
        for (const parent of parents(tree)) {
            const children = parent.children as RootContent[];
            children.forEach((child, i) => {
                if (child.type !== "paragraph" || child.children.length !== 1) return;
                const [image] = child.children;
                if (image?.type === "image" && CLIP.test(image.url)) children[i] = image;
            });
        }
    };
}
