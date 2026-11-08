"use client";

import { cx } from "../../../lib/cx";
import { Logo } from "../../brand/logo";

/** Stands in for the dithered logo, which replaces this file at merge: the still mark. */
export function DitherLogo({ className }: { className?: string }) {
    return (
        <div
            className={cx(
                "absolute inset-0 grid place-items-center text-text [&_svg]:h-(--x402-mark)",
                className,
            )}
        >
            <Logo withName={false} />
        </div>
    );
}
