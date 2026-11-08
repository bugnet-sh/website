import { docHref, prevNext } from "../../lib/content/docs";

const box = "block border-(length:--hairline) border-line p-(--space-4) hover:border-accent";
const label = "block text-(length:--fine-size) leading-(--fine-line) text-text-muted";
const title = "mt-(--space-1) block text-(length:--ui-size) leading-(--ui-line) text-text";

/** The pages before and after this one; an empty cell keeps Next on the right on the first page. */
export function PrevNext({ slug }: { slug: string }) {
    const { prev, next } = prevNext(slug);
    return (
        <nav
            aria-label="Previous and next"
            className="mt-(--space-8) grid grid-cols-2 gap-(--space-4)"
        >
            {prev ? (
                <a href={docHref(prev)} rel="prev" className={box}>
                    <span className={label}>Previous</span>
                    <span className={title}>{prev.title}</span>
                </a>
            ) : (
                <span />
            )}
            {next && (
                <a href={docHref(next)} rel="next" className={`${box} text-right`}>
                    <span className={label}>Next</span>
                    <span className={title}>{next.title}</span>
                </a>
            )}
        </nav>
    );
}
