"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/** A plus whose upright turns flat while its row is open, so it reads as a minus. */
function FoldMark() {
    return (
        <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="block size-(--faq-mark) shrink-0 fill-none stroke-current text-text-muted group-hover:text-text group-aria-expanded:text-accent"
            strokeWidth={1.5}
        >
            <path d="M0 8h16" />
            <path
                d="M8 0v16"
                className="origin-center transition-transform duration-300 group-aria-expanded:rotate-90 motion-reduce:transition-none"
            />
        </svg>
    );
}

/**
 * The questions as an accordion: each is a button that shows or hides its answer, all closed at
 * first. Up and Down move between the questions, Home and End go to the first and the last.
 */
export function FaqList({
    items,
}: {
    items: { id: string; question: string; answer: ReactNode }[];
}) {
    const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
    const base = useId();
    const buttons = useRef<(HTMLButtonElement | null)[]>([]);

    function toggle(id: string) {
        setOpen((was) => {
            const next = new Set(was);
            if (!next.delete(id)) next.add(id);
            return next;
        });
    }

    function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, i: number) {
        const last = items.length - 1;
        const to = {
            ArrowDown: i === last ? 0 : i + 1,
            ArrowUp: i === 0 ? last : i - 1,
            Home: 0,
            End: last,
        }[event.key];
        if (to === undefined) return;
        event.preventDefault();
        buttons.current[to]?.focus();
    }

    return (
        <ul className="border-t-(length:--hairline) border-line">
            {items.map((item, i) => {
                const expanded = open.has(item.id);
                const question = `${base}-${item.id}-q`;
                const answer = `${base}-${item.id}-a`;
                return (
                    <li key={item.id} className="border-b-(length:--hairline) border-line">
                        <h3>
                            <button
                                ref={(button) => {
                                    buttons.current[i] = button;
                                }}
                                id={question}
                                type="button"
                                aria-expanded={expanded}
                                aria-controls={answer}
                                onClick={() => toggle(item.id)}
                                onKeyDown={(event) => onKeyDown(event, i)}
                                className="group flex w-full items-center justify-between gap-(--space-5) py-(--space-5) pr-(--pad) pl-(--space-6) text-left text-(length:--cell-title-size) leading-(--cell-title-line) focus-visible:-outline-offset-(--ring) tablet:pl-(--pad)"
                            >
                                {item.question}
                                <FoldMark />
                            </button>
                        </h3>
                        <div
                            id={answer}
                            hidden={!expanded}
                            className="pr-(--pad) pb-(--space-5) pl-(--space-6) text-(length:--lead-size) leading-(--lead-line) text-text-muted transition-[opacity,translate] duration-300 starting:-translate-y-(--space-1) starting:opacity-0 motion-reduce:transition-none tablet:pl-(--pad)"
                        >
                            <div className="max-w-[64ch]">{item.answer}</div>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
