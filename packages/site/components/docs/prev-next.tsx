import { ArrowLeft, ArrowRight } from "lucide-react";
import { cx } from "../../lib/cx";
import { docHref, prevNext } from "../../lib/content/docs";

const cell =
    "group flex flex-col border-(length:--hairline) border-line px-(--space-5) py-(--space-4) hover:bg-surface";
const label =
    "flex items-center gap-(--space-2) text-(length:--fine-size) leading-(--fine-line) tracking-(--caps-tracking) text-text-muted uppercase";
const title =
    "mt-(--space-2) text-(length:--prose-size) leading-(--prose-line) text-text group-hover:text-accent";
const arrow = "block size-(--arrow) shrink-0";

/**
 * The pages before and after this one, as two bordered cells that share their middle line; an
 * empty cell keeps Next on the right on the first page.
 */
export function PrevNext({ slug }: { slug: string }) {
    const { prev, next } = prevNext(slug);
    return (
        <nav aria-label="Previous and next" className="mt-(--space-8) grid grid-cols-2">
            {prev ? (
                <a href={docHref(prev)} rel="prev" className={cell}>
                    <span className={label}>
                        <ArrowLeft aria-hidden="true" className={arrow} />
                        Previous
                    </span>
                    <span className={title}>{prev.title}</span>
                </a>
            ) : (
                <span />
            )}
            {next && (
                <a
                    href={docHref(next)}
                    rel="next"
                    className={cx(cell, "items-end text-right", prev && "-ml-(--hairline)")}
                >
                    <span className={label}>
                        Next
                        <ArrowRight aria-hidden="true" className={arrow} />
                    </span>
                    <span className={title}>{next.title}</span>
                </a>
            )}
        </nav>
    );
}
