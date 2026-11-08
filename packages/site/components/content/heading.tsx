import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

const levels = {
    1: "font-head text-(length:--title-size) leading-(--title-line) font-extralight",
    2: "mt-(--space-7) text-(length:--h2-size) leading-(--h2-line) font-semibold",
    3: "mt-(--space-6) text-(length:--h3-size) leading-(--h3-line) font-semibold",
    4: "mt-(--space-5) font-semibold",
} as const;

/**
 * An article heading. Below the title each carries a `#` link to itself that shows on hover or
 * keyboard focus; it is always laid out, so showing it moves nothing.
 */
export function Heading({
    level,
    id,
    children,
}: {
    level: keyof typeof levels;
    id?: string;
    children?: ReactNode;
}) {
    const Tag = `h${level}` as const;
    return (
        <Tag
            id={id}
            // Clears the sticky header when a link jumps here
            className={cx(
                "group scroll-mt-[calc(var(--nav)+var(--space-6))] text-text",
                // Opening the page, the title rises by its half-leading, so its letters sit near
                // the top of the search box and the On this page label beside it
                level === 1
                    ? "first:-mt-[calc((var(--title-line)-1)*var(--title-size)/2)]"
                    : "first:mt-0",
                levels[level],
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
