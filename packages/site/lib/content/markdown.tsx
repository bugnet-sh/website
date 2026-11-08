import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Blockquote } from "../../components/content/blockquote";
import { CodeBlock } from "../../components/content/code-block";
import { Heading } from "../../components/content/heading";
import { Link } from "../../components/content/link";
import { BodyCell, HeadCell, Table } from "../../components/content/table";
import { headingIds } from "./heading-ids";

type HastNode = NonNullable<ExtraProps["node"]>["children"][number];

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

const block = "mt-(--space-4) first:mt-0";

// The site's own parts replace the elements Markdown makes; each drops the hast `node` prop
const components: Components = {
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
    p: ({ children }) => <p className={block}>{children}</p>,
    ul: ({ children }) => (
        <ul
            className={`${block} list-disc pl-(--space-5) marker:text-text-muted [&>li+li]:mt-(--space-2)`}
        >
            {children}
        </ul>
    ),
    ol: ({ children, start }) => (
        <ol
            start={start}
            className={`${block} list-decimal pl-(--space-5) marker:text-text-muted [&>li+li]:mt-(--space-2)`}
        >
            {children}
        </ol>
    ),
    li: ({ children }) => <li className="[&>p:first-child]:mt-0">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold text-text">{children}</strong>,
    a: ({ href, children }) => <Link href={href}>{children}</Link>,
    blockquote: ({ children }) => <Blockquote>{children}</Blockquote>,
    pre: ({ node }) => (
        <CodeBlock code={node ? hastText(node).replace(/\n$/, "") : ""} lang={fenceLang(node)} />
    ),
    // Only inline code reaches here: a fenced block is rendered whole by `pre`
    code: ({ children }) => (
        <code className="bg-code-inline px-(--space-1) py-px font-mono">{children}</code>
    ),
    table: ({ children }) => <Table>{children}</Table>,
    th: ({ children }) => <HeadCell>{children}</HeadCell>,
    td: ({ children }) => <BodyCell>{children}</BodyCell>,
    hr: () => <hr className="mt-(--space-7) border-line" />,
};

/** Markdown rendered to React elements at build time, never to an HTML string. */
export function Markdown({ source }: { source: string }) {
    return (
        <ReactMarkdown remarkPlugins={[remarkGfm, headingIds]} components={components}>
            {source}
        </ReactMarkdown>
    );
}
