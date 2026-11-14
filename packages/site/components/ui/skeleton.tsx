import { cx } from "../../lib/cx";

/**
 * A bar where text will be. Its box is exactly that text's line, so the text arriving moves
 * nothing; padding, not margin, keeps the bar off the line's edges, so it never collapses into the
 * gap above it, and the fill is clipped to the bar.
 */
const lines = {
    fine: "h-(--fine-line) py-(--space-1)",
    ui: "h-(--ui-line) py-(--space-1)",
    title: "h-(--cell-title-line) py-(--space-1)",
    stat: "h-(--stat-line) py-(--space-1)",
} as const;

/**
 * A skeleton bar for a value still loading (founder, 2026-11-13: "A with skeleton loaders"). It
 * pulses while the feed is on its way and stands still once the feed is off, under the line that
 * says so.
 */
export function Skeleton({
    line,
    className,
    still = false,
}: {
    line?: keyof typeof lines;
    className?: string;
    still?: boolean;
}) {
    return (
        <span
            aria-hidden="true"
            className={cx(
                "block bg-surface-hover bg-clip-content",
                line && lines[line],
                !still && "animate-pulse motion-reduce:animate-none",
                className,
            )}
        />
    );
}
