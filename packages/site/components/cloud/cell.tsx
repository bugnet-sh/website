import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Skeleton } from "../ui/skeleton";

/** Every part of a server card sits in this inset, so labels and values share one left edge */
export const inset = "px-(--space-5) phone:px-(--space-4)";

/**
 * The card's one column grid: four columns, two on phones. A hairline gap over the line colour
 * draws the rules between cells, so the header, the specs and the live numbers share columns.
 */
export const cells = "grid grid-cols-4 gap-(--hairline) bg-line phone:grid-cols-2";

/** A label over its value, in the one type every cell uses */
export function Cell({
    label,
    children,
    className,
}: {
    label: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cx("min-w-0 bg-bg py-(--space-3)", inset, className)}>
            <dt className="text-(length:--fine-size) leading-(--fine-line) text-text-muted">
                {label}
            </dt>
            <dd className="mt-(--space-1) text-(length:--ui-size) leading-(--ui-line)">
                {children}
            </dd>
        </div>
    );
}

/** A cell still waiting for the feed: its label and its value as bars, at the cell's own height */
export function WaitingCell({ className, still }: { className?: string; still: boolean }) {
    return (
        <div className={cx("min-w-0 bg-bg py-(--space-3)", inset, className)}>
            <Skeleton line="fine" className="w-1/2" still={still} />
            <Skeleton line="ui" className="mt-(--space-1) w-2/3" still={still} />
        </div>
    );
}
