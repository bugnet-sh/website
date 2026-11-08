import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { bodyCell, headCell, tableClass } from "../stats/cells";

// Prose cells wrap, unlike feed cells, and pad above and below for the lines they wrap to
const prose = "py-(--space-2) whitespace-normal!";

/** A Markdown table in the stats table's cells, scrolled sideways if a phone is too narrow. */
export function Table({ children }: { children?: ReactNode }) {
    return (
        <div className="mt-(--space-4) overflow-x-auto first:mt-0">
            <table className={tableClass}>{children}</table>
        </div>
    );
}

export function HeadCell({ children }: { children?: ReactNode }) {
    return <th className={cx(headCell(), prose)}>{children}</th>;
}

export function BodyCell({ children }: { children?: ReactNode }) {
    return <td className={cx(bodyCell(), prose)}>{children}</td>;
}
