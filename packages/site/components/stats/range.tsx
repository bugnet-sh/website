"use client";

import { useRef, type KeyboardEvent } from "react";
import { cx } from "../../lib/cx";
import { ranges, type Range } from "../../lib/stats/view";

const step: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** A segmented radio group: Tab reaches the chosen range, arrows move the choice, as radios do. */
export function RangeControl({
    value,
    onChange,
}: {
    value: Range;
    onChange: (range: Range) => void;
}) {
    const buttons = useRef<(HTMLButtonElement | null)[]>([]);

    const onKeyDown = (e: KeyboardEvent) => {
        const move = step[e.key];
        if (move === undefined) return;
        e.preventDefault();
        const at = ranges.findIndex((r) => r.value === value);
        const next = (at + move + ranges.length) % ranges.length;
        onChange((ranges[next] as (typeof ranges)[number]).value);
        buttons.current[next]?.focus();
    };

    return (
        <div role="radiogroup" aria-label="Range" className="flex" onKeyDown={onKeyDown}>
            {ranges.map((range, i) => {
                const checked = range.value === value;
                return (
                    <button
                        key={range.value}
                        ref={(el) => {
                            buttons.current[i] = el;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        aria-label={range.name}
                        tabIndex={checked ? 0 : -1}
                        onClick={() => onChange(range.value)}
                        className={cx(
                            "h-(--segment) cursor-pointer border-(length:--hairline) px-(--space-2) text-(length:--fine-size) leading-(--fine-line) whitespace-nowrap",
                            checked
                                ? "border-line text-text"
                                : "border-transparent text-text-muted hover:text-text",
                        )}
                    >
                        {range.label}
                    </button>
                );
            })}
        </div>
    );
}
