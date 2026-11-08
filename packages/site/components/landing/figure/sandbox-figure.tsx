import { cx } from "../../../lib/cx";

/** Stands in for the isometric sandbox drawing, which replaces this file at merge. */
export function SandboxFigure({ className }: { className?: string }) {
    return <div aria-hidden className={cx("absolute inset-0", className)} />;
}
