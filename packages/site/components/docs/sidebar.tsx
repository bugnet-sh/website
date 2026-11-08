"use client";

import { useCallback, useId, useState } from "react";
import { cx } from "../../lib/cx";
import { docHref, docs } from "../../lib/content/docs";
import { ChevronIcon } from "../icons";
import { Search } from "./search";

/**
 * Search and the docs pages, the current one marked. At tablet width and under it folds into
 * the Docs menu button above the article.
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
                className="hidden h-(--button) items-center justify-between border-(length:--hairline) border-line px-(--space-3) text-(length:--ui-size) leading-(--ui-line) text-text tablet:flex"
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
                    <ul className="border-l-(length:--hairline) border-line">
                        {docs.map((doc) => (
                            <li key={doc.file}>
                                <a
                                    href={docHref(doc)}
                                    aria-current={doc.slug === current ? "page" : undefined}
                                    className="-ml-(--hairline) block border-l-(length:--hairline) border-transparent py-(--space-1) pl-(--space-3) text-(length:--ui-size) leading-(--ui-line) text-text-muted hover:text-text aria-[current=page]:border-accent aria-[current=page]:text-text"
                                >
                                    {doc.title}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>
            </div>
        </div>
    );
}
