import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

const levels = {
    1: "text-(length:--h1-size) leading-(--h1-line) font-medium",
    2: "mt-(--h2-gap) text-(length:--h2-size) leading-(--h2-line) font-medium",
    3: "mt-(--h3-gap) text-(length:--h3-size) leading-(--h3-line) font-medium",
    4: "mt-(--h4-gap) text-(length:--h4-size) leading-(--h4-line) font-semibold",
} as const;

/**
 * An article heading. Below the title each carries a `#` link to itself that shows on hover or
 * keyboard focus; it is always laid out, so showing it moves nothing.
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
    return (
        <Tag
            id={id}
            // Clears the sticky header when a link jumps here
            className={cx(
                "group scroll-mt-[calc(var(--nav)+var(--space-6))] text-text first:mt-0",
                levels[level],
                className,
            )}
        >
            {children}
            {level > 1 && id && (
                <a
                    href={`#${id}`}
                    aria-label="Link to this section"
                    className="ml-(--space-2) text-text-muted opacity-0 group-hover:opacity-100 hover:text-accent focus-visible:opacity-100"
                >
                    #
                </a>
            )}
        </Tag>
    );
}
