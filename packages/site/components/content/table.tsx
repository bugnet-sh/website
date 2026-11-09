import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { bodyCell, headCell, tableClass } from "../stats/cells";
import { ScrollX } from "./scroll-x";

// Prose cells wrap, unlike feed cells, pad above and below for the lines they wrap to, and start
// at the top, so a row of cells of different lengths reads across. On a phone each keeps a
// readable width and inline code stays whole, so a wide table scrolls rather than squeezes
const prose =
    "py-(--space-2) align-top whitespace-normal! phone:min-w-(--prose-cell) [&_code]:whitespace-nowrap";

/** A Markdown table in the stats table's cells, scrolled sideways when it is wider than the page. */
export function Table({ children }: { children?: ReactNode }) {
    return (
        <ScrollX className="mt-(--prose-gap) first:mt-0">
            <table className={tableClass}>{children}</table>
        </ScrollX>
    );
}

export function HeadCell({ children }: { children?: ReactNode }) {
    return <th className={cx(headCell(), prose)}>{children}</th>;
}

export function BodyCell({ children }: { children?: ReactNode }) {
    return <td className={cx(bodyCell(), prose)}>{children}</td>;
}
