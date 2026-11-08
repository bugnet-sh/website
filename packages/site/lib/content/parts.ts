import type { Data, Root } from "mdast";

type Properties = NonNullable<Data["hProperties"]>;

/** Adds HTML properties to a node, which the renderer reads off the element it becomes. */
export function mark(node: { data?: Data }, properties: Properties): void {
    node.data = { ...node.data, hProperties: { ...node.data?.hProperties, ...properties } };
}

/** A remark plugin that marks the paragraph right under the title as the page's lead. */
export function lead() {
    return (tree: Root) => {
        const at = tree.children.findIndex((n) => n.type === "heading" && n.depth === 1);
        const next = at < 0 ? undefined : tree.children[at + 1];
        if (next?.type === "paragraph") mark(next, { dataLead: "" });
    };
}
