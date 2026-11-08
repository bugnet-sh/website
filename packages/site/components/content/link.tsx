import type { ReactNode } from "react";
import { isExternal, siteHref } from "../../lib/content/href";
import { ExternalArrow } from "../icons";

const style =
    "text-text underline decoration-text-muted underline-offset-4 hover:text-accent hover:decoration-accent";

export function Link({ href = "", children }: { href?: string; children?: ReactNode }) {
    if (!isExternal(href)) {
        return (
            <a href={siteHref(href)} className={style}>
                {children}
            </a>
        );
    }
    return (
        <a href={href} target="_blank" rel="noreferrer" className={style}>
            {children}
            <span className="sr-only"> (opens in a new tab)</span>
            {/* Inline, so a link that wraps keeps the arrow after its last word */}
            <span className="ml-(--space-1) inline-block">
                <ExternalArrow />
            </span>
        </a>
    );
}
