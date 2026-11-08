import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { headingIds, headingText } from "./heading-ids";

export type TocItem = { id: string; text: string; depth: 2 | 3 };

/** The h2 and h3 headings of a Markdown source, with the ids `Markdown` renders them with. */
export function tocOf(source: string): TocItem[] {
    const processor = unified().use(remarkParse).use(remarkGfm).use(headingIds);
    const tree = processor.runSync(processor.parse(source)) as Root;
    return tree.children.flatMap((node) =>
        node.type === "heading" && (node.depth === 2 || node.depth === 3)
            ? [
                  {
                      id: String(node.data?.hProperties?.id),
                      text: headingText(node),
                      depth: node.depth,
                  },
              ]
            : [],
    );
}
