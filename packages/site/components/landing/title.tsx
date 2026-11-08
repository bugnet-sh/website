import type { ReactNode } from "react";

/** A landing band's heading, in the same face as the hero's, a size down. */
export function LandingTitle({ id, children }: { id: string; children: ReactNode }) {
    return (
        <h2
            id={id}
            className="font-head text-(length:--title-size) leading-(--title-line) font-extralight"
        >
            {children}
        </h2>
    );
}
