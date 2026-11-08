"use client";

import { Children, isValidElement, useId, useRef, useState, type KeyboardEvent } from "react";
import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };

/**
 * Code blocks that say the same thing several ways, one tab each, as the ARIA tabs pattern has
 * it: Tab reaches the chosen tab, and the arrows, Home and End move the choice. Every panel is
 * in the page, so search and the export hold them all, and print shows each under its name.
 */
export function CodeTabs({ names, children }: { names: string[]; children?: ReactNode }) {
    const panels = Children.toArray(children).filter(isValidElement);
    const [at, setAt] = useState(0);
    const buttons = useRef<(HTMLButtonElement | null)[]>([]);
    const base = useId();

    const choose = (next: number) => {
        setAt(next);
        buttons.current[next]?.focus();
    };

    const onKeyDown = (event: KeyboardEvent) => {
        const move = step[event.key];
        let next: number | undefined;
        if (move !== undefined) next = (at + move + names.length) % names.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = names.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        choose(next);
    };

    return (
        <div className="mt-(--prose-gap) first:mt-0">
            <div
                role="tablist"
                onKeyDown={onKeyDown}
                className="flex overflow-x-auto border-(length:--hairline) border-b-0 border-line bg-surface [scrollbar-width:none] print:hidden"
            >
                {names.map((name, i) => {
                    const selected = i === at;
                    return (
                        <button
                            key={name}
                            ref={(el) => {
                                buttons.current[i] = el;
                            }}
                            type="button"
                            role="tab"
                            id={`${base}-tab-${i}`}
                            aria-selected={selected}
                            aria-controls={`${base}-panel-${i}`}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => setAt(i)}
                            className={cx(
                                "h-(--hit) shrink-0 cursor-pointer border-b-(length:--ring) px-(--space-4) text-(length:--ui-size) leading-(--ui-line) whitespace-nowrap focus-visible:-outline-offset-(--ring)",
                                selected
                                    ? "border-accent-3 text-text"
                                    : "border-transparent text-text-muted hover:text-text",
                            )}
                        >
                            {name}
                        </button>
                    );
                })}
            </div>
            {panels.map((panel, i) => (
                <div
                    key={names[i] ?? i}
                    role="tabpanel"
                    id={`${base}-panel-${i}`}
                    aria-labelledby={`${base}-tab-${i}`}
                    // The block sits right under the tabs: its own space above is for prose
                    className={cx(
                        "[&>div]:mt-0",
                        i !== at && "hidden print:block print:mt-(--space-4)",
                    )}
                >
                    <p className="hidden text-(length:--fine-size) leading-(--fine-line) text-text-muted print:mb-(--space-1) print:block">
                        {names[i]}
                    </p>
                    {panel}
                </div>
            ))}
        </div>
    );
}
