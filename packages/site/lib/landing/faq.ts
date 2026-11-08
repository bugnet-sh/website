import type { Root, RootContent } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { headingIds, headingText } from "../content/heading-ids";

/** One question of the docs' FAQ, with its answer as the Markdown under it. */
export type FaqItem = { id: string; question: string; answer: string };

/**
 * The questions a visitor asks first, by the ids the docs' FAQ page gives their headings. Which
 * agents work is left to the Install band, since its docs answer is protocol talk.
 */
export const landingQuestions = [
    "do-i-need-an-account-or-an-api-key",
    "what-does-a-run-cost",
    "which-wallets-can-pay",
    "can-i-be-charged-twice-for-one-order",
    "what-if-the-sandbox-never-starts",
    "does-bugnet-use-ai-or-read-my-code",
    "will-my-agent-offer-bugnet-for-everything",
    "is-it-open-source",
];

/** Every `##` question of an FAQ page, with the heading ids its docs page renders. */
export function faqItems(markdown: string): FaqItem[] {
    const processor = unified().use(remarkParse).use(remarkGfm).use(headingIds);
    const tree = processor.runSync(processor.parse(markdown)) as Root;
    const found: { id: string; question: string; nodes: RootContent[] }[] = [];
    let current: (typeof found)[number] | undefined;
    for (const node of tree.children) {
        if (node.type === "heading" && node.depth <= 2) {
            current = undefined;
            if (node.depth === 2) {
                const id = String(node.data?.hProperties?.id);
                found.push((current = { id, question: headingText(node).trim(), nodes: [] }));
            }
            continue;
        }
        current?.nodes.push(node);
    }
    return found.map(({ id, question, nodes }) => {
        const [start, end] = [nodes[0]?.position?.start.offset, nodes.at(-1)?.position?.end.offset];
        if (start === undefined || end === undefined) {
            throw new Error(`faq.md: {#${id}} has no answer`);
        }
        return { id, question, answer: markdown.slice(start, end) };
    });
}

/**
 * The landing page's questions, read from the docs' FAQ so the two never disagree. A question the
 * docs no longer have fails the build rather than leaving a gap.
 */
export function landingFaq(markdown: string, ids: readonly string[] = landingQuestions) {
    const items = new Map(faqItems(markdown).map((item) => [item.id, item]));
    return ids.map((id) => {
        const item = items.get(id);
        if (!item) throw new Error(`faq.md has no question {#${id}}`);
        return item;
    });
}
