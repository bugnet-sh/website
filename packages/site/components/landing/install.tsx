"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Link } from "../content/link";
import { Band } from "../shell/frame";
import { SectionTitle } from "../stats/panels";

export type InstallTab = { id: string; name: string; panel: ReactNode };

const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };

/**
 * One tab per client. Tab reaches the chosen one and the arrows, Home and End move the choice,
 * as the ARIA tabs pattern has it. Every panel is in the page, so the export holds them all.
 */
export function InstallTabs({ tabs }: { tabs: InstallTab[] }) {
    const [at, setAt] = useState(0);
    const buttons = useRef<(HTMLButtonElement | null)[]>([]);
    const base = useId();

    const choose = (next: number) => {
        setAt(next);
        buttons.current[next]?.focus();
    };

    const onKeyDown = (e: KeyboardEvent) => {
        const move = step[e.key];
        let next: number | undefined;
        if (move !== undefined) next = (at + move + tabs.length) % tabs.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;
        if (next === undefined) return;
        e.preventDefault();
        choose(next);
    };

    return (
        <>
            <div
                role="tablist"
                aria-label="Client"
                className="flex flex-wrap"
                onKeyDown={onKeyDown}
            >
                {tabs.map((tab, i) => {
                    const selected = i === at;
                    return (
                        <button
                            key={tab.id}
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
                                "relative h-(--button) cursor-pointer border-(length:--hairline) px-(--space-3) before:absolute before:inset-x-0 before:-inset-y-[calc((var(--hit)-var(--button))/2)] before:content-[''] text-(length:--ui-size) leading-(--ui-line) whitespace-nowrap",
                                selected
                                    ? "border-line text-text"
                                    : "border-transparent text-text-muted hover:text-text",
                            )}
                        >
                            {tab.name}
                        </button>
                    );
                })}
            </div>
            {tabs.map((tab, i) => (
                <div
                    key={tab.id}
                    role="tabpanel"
                    id={`${base}-panel-${i}`}
                    aria-labelledby={`${base}-tab-${i}`}
                    hidden={i !== at}
                    className="mt-(--space-4)"
                >
                    {tab.panel}
                </div>
            ))}
        </>
    );
}

/** The install band: each client's lines from the docs, then the terms a reader accepts. */
export function Install({ tabs }: { tabs: InstallTab[] }) {
    const id = useId();
    return (
        <Band>
            <section aria-labelledby={id} className="py-(--space-6)">
                <SectionTitle id={id}>Install</SectionTitle>
                <div className="mt-(--space-4)">
                    <InstallTabs tabs={tabs} />
                </div>
                <p className="mt-(--space-4) text-(length:--ui-size) leading-(--ui-line) text-text-muted">
                    By installing Bugnet you accept the <Link href="/terms/">Terms</Link>.
                </p>
            </section>
        </Band>
    );
}
