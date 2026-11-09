import { Children, type ReactNode } from "react";
import { cx } from "../../lib/cx";

const levels = {
    1: "text-(length:--h1-size) leading-(--h1-line) font-medium",
    2: "mt-(--h2-gap) text-(length:--h2-size) leading-(--h2-line) font-medium",
    3: "mt-(--h3-gap) text-(length:--h3-size) leading-(--h3-line) font-medium",
    4: "mt-(--h4-gap) text-(length:--h4-size) leading-(--h4-line) font-semibold",
} as const;

const STEP = /^(\d+)\.\s+/;

/** A heading that opens with a number, as "3. Ask your agent" does: the number and the rest. */
function stepOf(children: ReactNode): { n: string; rest: ReactNode[] } | undefined {
    const [first, ...others] = Children.toArray(children);
    const match = typeof first === "string" ? STEP.exec(first) : null;
    if (!match?.[1] || typeof first !== "string") return undefined;
    return { n: match[1], rest: [first.slice(match[0].length), ...others] };
}

/**
 * An article heading. Below the title each carries a `#` link to itself that shows on hover or
 * keyboard focus; it is always laid out, so showing it moves nothing. An H2 that opens with a
 * number is a step: the number shows as a "01" marker, and screen readers still hear "3. ".
 */
export function Heading({
    level,
    id,
    className,
    children,
}: {
    level: keyof typeof levels;
    id?: string;
    className?: string;
    children?: ReactNode;
}) {
    const Tag = `h${level}` as const;
    const step = level === 2 ? stepOf(children) : undefined;
    const anchor = level > 1 && id && (
        <a
            href={`#${id}`}
            aria-label="Link to this section"
            className="ml-(--space-2) text-text-muted opacity-0 group-hover:opacity-100 hover:text-accent focus-visible:opacity-100"
        >
            #
        </a>
    );
    return (
        <Tag
            id={id}
            // Clears the sticky header when a link jumps here
            className={cx(
                "group scroll-mt-[calc(var(--nav)+var(--space-6))] text-text first:mt-0",
                levels[level],
                step && "flex items-start gap-(--space-3)",
                className,
            )}
        >
            {step ? (
                <>
                    <span
                        aria-hidden
                        className="grid h-(--h2-line) min-w-(--step-marker) shrink-0 place-items-center border-(length:--hairline) border-line bg-surface px-(--space-1) font-mono text-(length:--ui-size) leading-(--ui-line) text-accent"
                    >
                        {step.n.padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                        <span className="sr-only">{step.n}. </span>
                        {step.rest}
                        {anchor}
                    </span>
                </>
            ) : (
                <>
                    {children}
                    {anchor}
                </>
            )}
        </Tag>
    );
}
