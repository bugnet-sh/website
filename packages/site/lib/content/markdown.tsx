import type { ReactNode } from "react";
import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Blockquote, Callout, isCalloutKind } from "../../components/content/blockquote";
import { Clip } from "../../components/content/clip";
import { CodeBlock } from "../../components/content/code-block";
import { CodeTabs } from "../../components/content/code-tabs";
import { Heading } from "../../components/content/heading";
import { Link } from "../../components/content/link";
import { Mermaid } from "../../components/content/mermaid";
import { NextSteps, type NextStep } from "../../components/content/next-steps";
import { BodyCell, HeadCell, Table } from "../../components/content/table";
import { cx } from "../cx";
import { headingIds } from "./heading-ids";
import { isShell } from "./highlight";
import { CLIP, callouts, clips, codeTabs, lead, nextSteps } from "./parts";

type HastElement = NonNullable<ExtraProps["node"]>;
type HastNode = HastElement["children"][number];

/** The element children of a hast node, with the newlines between them left out. */
function elements(node: HastNode | undefined): HastElement[] {
    if (!node || !("children" in node)) return [];
    return node.children.filter((child): child is HastElement => child.type === "element");
}

function hastText(node: HastNode): string {
    if (node.type === "text") return node.value;
    if ("children" in node) return node.children.map(hastText).join("");
    return "";
}

/** The language a fence names, which remark writes as `language-…` on the block's code. */
function fenceLang(node: ExtraProps["node"]): string | undefined {
    const code = node?.children[0];
    if (code?.type !== "element") return undefined;
    const names = code.properties.className;
    const name = Array.isArray(names) ? names.find((n) => String(n).startsWith("language-")) : null;
    return name ? String(name).slice("language-".length) : undefined;
}

/** The tab each fence of a tabbed block names, in order. */
function tabNames(node: ExtraProps["node"]): string[] {
    return elements(node).map((pre) => String(elements(pre)[0]?.properties.dataTab ?? ""));
}

/** A Next steps list's cards, each `[Title](/docs/…/): one sentence.` */
function cardsOf(node: ExtraProps["node"]): NextStep[] {
    return elements(node).map((li) => {
        // A tight list's items hold their text directly, a loose list's in a paragraph
        const first = elements(li)[0];
        const line = first?.tagName === "p" ? first : li;
        const [link, ...rest] = line.children.filter(
            (child) => child.type !== "text" || child.value.trim() !== "",
        );
        const href = link?.type === "element" ? String(link.properties.href ?? "") : "";
        const title = link ? hastText(link) : "";
        const text = rest.map(hastText).join("").replace(/^:\s*/, "");
        return { href, title, text };
    });
}

/**
 * How the blocks are set. An article (docs, terms, privacy) reads at 16/26 with square bullets
 * and mono "01." numbers, as z402's docs do; the landing page's answers and steps keep their own
 * smaller type.
 */
const looks = {
    article: {
        block: "mt-(--prose-gap) first:mt-0",
        ul: "list-[square] pl-(--list-indent) marker:text-text-muted",
        ol: "list-[decimal-leading-zero] pl-(--list-indent-ordered) marker:font-mono marker:text-(length:--ui-size) marker:text-text-muted",
        code: "text-(length:--code-inline-size) text-text",
    },
    plain: {
        block: "mt-(--space-4) first:mt-0",
        ul: "list-disc pl-(--space-5) marker:text-text-muted",
        ol: "list-decimal pl-(--space-5) marker:text-text-muted",
        code: "",
    },
} as const;

export type Look = keyof typeof looks;

// The site's own parts replace the elements Markdown makes; each drops the hast `node` prop
function componentsOf(look: Look): Components {
    const { block, ul, ol, code } = looks[look];
    return {
        h1: ({ id, children }) => (
            <Heading level={1} id={id}>
                {children}
            </Heading>
        ),
        h2: ({ id, children }) => (
            <Heading level={2} id={id}>
                {children}
            </Heading>
        ),
        h3: ({ id, children }) => (
            <Heading level={3} id={id}>
                {children}
            </Heading>
        ),
        h4: ({ id, children }) => (
            <Heading level={4} id={id}>
                {children}
            </Heading>
        ),
        // The paragraph under the title is the lead: larger, muted, and further from what follows
        p: ({ node, children }) => {
            if (node?.properties.dataLead !== undefined) {
                return (
                    <p className="mt-(--space-4) mb-(--space-6) text-(length:--article-lead-size) leading-(--article-lead-line) text-text-muted">
                        {children}
                    </p>
                );
            }
            // A callout's title, beside its label
            if (node?.properties.dataCalloutTitle !== undefined) {
                return (
                    <p data-callout-title="" className="font-medium text-text">
                        {children}
                    </p>
                );
            }
            return <p className={cx(block, "text-pretty")}>{children}</p>;
        },
        ul: ({ node, children }) =>
            node?.properties.dataNextSteps === undefined ? (
                <ul className={cx(block, ul, "[&>li+li]:mt-(--space-2)")}>{children}</ul>
            ) : (
                <NextSteps steps={cardsOf(node)} />
            ),
        ol: ({ children, start }) => (
            <ol start={start} className={cx(block, ol, "[&>li+li]:mt-(--space-2)")}>
                {children}
            </ol>
        ),
        li: ({ children }) => <li className="text-pretty [&>p:first-child]:mt-0">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-text">{children}</strong>,
        a: ({ href, children }) => <Link href={href}>{children}</Link>,
        blockquote: ({ node, children }) => {
            const kind = node?.properties.dataCallout;
            return isCalloutKind(kind) ? (
                <Callout kind={kind}>{children}</Callout>
            ) : (
                <Blockquote>{children}</Blockquote>
            );
        },
        // Only fences in a row that each name a tab become a div
        div: ({ node, children }) =>
            node?.properties.dataCodeTabs === undefined ? (
                <div>{children}</div>
            ) : (
                <CodeTabs names={tabNames(node)}>{children}</CodeTabs>
            ),
        img: ({ src, alt }) =>
            typeof src === "string" && CLIP.test(src) ? (
                <Clip src={src} title={alt ?? ""} />
            ) : (
                <img src={src} alt={alt ?? ""} />
            ),
        pre: ({ node }) => {
            const text = node ? hastText(node).replace(/\n$/, "") : "";
            const lang = fenceLang(node);
            return lang === "mermaid" ? (
                <Mermaid source={text} />
            ) : (
                <CodeBlock
                    code={text}
                    lang={lang}
                    long={isShell(lang) ? "wrap" : "fade"}
                    className={block}
                />
            );
        },
        // Only inline code reaches here: a fenced block is rendered whole by `pre`
        code: ({ children }) => (
            <code
                className={cx(
                    "bg-code-inline box-decoration-clone px-(--space-1) py-px font-mono",
                    code,
                )}
            >
                {children}
            </code>
        ),
        table: ({ children }) => <Table>{children}</Table>,
        th: ({ children }) => <HeadCell>{children}</HeadCell>,
        td: ({ children }) => <BodyCell>{children}</BodyCell>,
        hr: () => <hr className="mt-(--space-7) border-line" />,
    };
}

const components = { article: componentsOf("article"), plain: componentsOf("plain") };

/**
 * Markdown rendered to React elements at build time, never to an HTML string. Above the title, a
 * label sits at the left of a row and an action at its right; the two and the title make one
 * block.
 */
export function Markdown({
    source,
    look = "plain",
    titleLabel,
    titleAction,
}: {
    source: string;
    look?: Look;
    titleLabel?: ReactNode;
    titleAction?: ReactNode;
}) {
    const parts: Components =
        titleLabel || titleAction
            ? {
                  ...components[look],
                  h1: ({ id, children }) => (
                      <div>
                          <div className="flex min-h-(--button) items-center justify-between gap-x-(--space-5)">
                              {titleLabel ?? <span />}
                              {titleAction}
                          </div>
                          <Heading level={1} id={id} className="mt-(--space-5)">
                              {children}
                          </Heading>
                      </div>
                  ),
              }
            : components[look];
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm, headingIds, lead, callouts, codeTabs, nextSteps, clips]}
            components={parts}
        >
            {source}
        </ReactMarkdown>
    );
}
