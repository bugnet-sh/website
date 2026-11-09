"use client";

import { useEffect, useState } from "react";
import { cx } from "../../lib/cx";
import { currentHeading } from "../../lib/content/scroll-spy";
import type { TocItem } from "../../lib/content/toc";

/** The article's h2 and h3 headings, marking the one the reader is in. */
export function OnThisPage({ items }: { items: TocItem[] }) {
    const [current, setCurrent] = useState(items[0]?.id);

    useEffect(() => {
        const headings = items.flatMap((item) => document.getElementById(item.id) ?? []);
        const first = headings[0];
        if (!first) return;
        // A heading a link jumped to sits at its scroll margin, so it counts as reached there
        const line = parseFloat(getComputedStyle(first).scrollMarginTop) + 1;
        const update = () =>
            setCurrent(
                currentHeading(
                    headings.map((h) => ({ id: h.id, top: h.getBoundingClientRect().top })),
                    line,
                ),
            );
        // Once a frame while the page scrolls or resizes, so a heading that stops right on the
        // line counts too
        let frame = 0;
        const schedule = () => {
            if (frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                update();
            });
        };
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        update();
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
        };
    }, [items]);

    return (
        <nav aria-labelledby="on-this-page">
            <p
                id="on-this-page"
                className="text-(length:--fine-size) leading-(--fine-line) tracking-(--caps-tracking) text-text-muted uppercase"
            >
                On this page
            </p>
            <ul className="mt-(--space-3) border-l-(length:--hairline) border-line">
                {items.map((item) => (
                    <li key={item.id}>
                        <a
                            href={`#${item.id}`}
                            aria-current={item.id === current ? "true" : undefined}
                            className={cx(
                                "-ml-(--hairline) block border-l-(length:--hairline) border-transparent py-(--space-1) text-(length:--ui-size) leading-(--ui-line) text-text-muted hover:text-text aria-[current=true]:border-accent aria-[current=true]:text-text",
                                item.depth === 2 ? "pl-(--space-3)" : "pl-(--space-6)",
                            )}
                        >
                            {item.text}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
