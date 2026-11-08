"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { cx } from "../../lib/cx";

/** The right edge fades while a box's content runs on past it. */
export const fade =
    "data-more:[mask-image:linear-gradient(to_left,transparent,#000_var(--space-7))]";

/**
 * Whether a sideways scroller's content runs on past its right edge, kept current as the reader
 * scrolls and as the box or its content changes size.
 */
export function useMore(ref: RefObject<HTMLElement | null>): boolean {
    const [more, setMore] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const measure = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        for (const child of el.children) observer.observe(child);
        el.addEventListener("scroll", measure, { passive: true });
        measure();
        return () => {
            observer.disconnect();
            el.removeEventListener("scroll", measure);
        };
    }, [ref]);
    return more;
}

/** A box that scrolls sideways when its content is wider, so a cut line looks cut. */
export function ScrollX({ className, children }: { className?: string; children?: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const more = useMore(ref);
    return (
        <div
            ref={ref}
            data-more={more || undefined}
            className={cx("overflow-x-auto", fade, className)}
        >
            {children}
        </div>
    );
}
