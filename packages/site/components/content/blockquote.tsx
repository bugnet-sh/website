import type { ReactNode } from "react";

/** A callout: a quoted block on the surface colour. */
export function Blockquote({ children }: { children?: ReactNode }) {
    return (
        <blockquote className="mt-(--space-4) border-(length:--hairline) border-line bg-surface px-(--space-4) py-(--space-3) first:mt-0">
            {children}
        </blockquote>
    );
}
