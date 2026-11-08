"use client";

import { useCallback, useId, useState } from "react";
import { cx } from "../../lib/cx";
import { docHref, docsByGroup } from "../../lib/content/docs";
import { ChevronIcon } from "../icons";
import { Search } from "./search";

/**
 * Search and the docs pages in their groups, the current one a filled row. At tablet width and
 * under it folds into the Docs menu button above the article.
 */
export function Sidebar({ current }: { current: string }) {
    const [open, setOpen] = useState(false);
    const panelId = useId();
    const reveal = useCallback(() => setOpen(true), []);

    return (
        <div className="flex min-h-0 flex-col">
            <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen((was) => !was)}
                className="relative hidden h-(--button) items-center justify-between border-(length:--hairline) border-line px-(--space-3) text-(length:--ui-size) leading-(--ui-line) text-text before:absolute before:inset-x-0 before:-inset-y-[calc((var(--hit)-var(--button))/2)] before:content-[''] tablet:flex"
            >
                Docs menu
                <ChevronIcon open={open} />
            </button>
            <div
                id={panelId}
                className={cx(
                    "flex min-h-0 flex-col tablet:mt-(--space-3)",
                    !open && "tablet:hidden",
                )}
            >
                <Search onReveal={reveal} />
                <nav aria-label="Docs" className="mt-(--space-5) min-h-0 overflow-y-auto">
                    {docsByGroup().map(({ group, docs }, i) => (
                        <div key={group} className={cx(i > 0 && "mt-(--space-5)")}>
                            <p
                                id={`${panelId}-${i}`}
                                className="px-(--space-3) text-(length:--fine-size) leading-(--fine-line) tracking-(--caps-tracking) text-text-muted uppercase"
                            >
                                {group}
                            </p>
                            <ul aria-labelledby={`${panelId}-${i}`} className="mt-(--space-2)">
                                {docs.map((doc) => {
                                    const here = doc.slug === current;
                                    return (
                                        <li key={doc.file}>
                                            <a
                                                href={docHref(doc)}
                                                aria-current={here ? "page" : undefined}
                                                className={cx(
                                                    "flex min-h-(--nav-row) items-center px-(--space-3) py-(--space-1) text-(length:--ui-size) leading-(--ui-line)",
                                                    here
                                                        ? "bg-accent text-accent-ink"
                                                        : "text-text-muted hover:bg-surface hover:text-text",
                                                )}
                                            >
                                                {doc.title}
                                            </a>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>
            </div>
        </div>
    );
}
