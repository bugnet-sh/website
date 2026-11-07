"use client";

import { useEffect, useId, useRef, useState } from "react";

// Long enough for the pointer to cross the gap between the ? and its text
const HIDE_MS = 300;

/**
 * The ? that explains on demand. Its text is placed absolutely against the nearest positioned
 * ancestor, such as the row the tip sits in, so it never runs off a narrow screen and showing it
 * moves nothing.
 */
export function Tip({ text, label }: { text: string; label: string }) {
    const id = useId();
    const [open, setOpen] = useState(false);
    const button = useRef<HTMLButtonElement>(null);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

    const show = () => {
        clearTimeout(timer.current);
        setOpen(true);
    };
    const hide = () => {
        clearTimeout(timer.current);
        setOpen(false);
    };

    useEffect(() => {
        if (!open) return;
        // On the document, so Escape also closes a tip that hover alone opened
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") hide();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);

    useEffect(() => () => clearTimeout(timer.current), []);

    return (
        <span
            className="inline-flex"
            onMouseEnter={show}
            onMouseLeave={() => {
                if (document.activeElement !== button.current) {
                    timer.current = setTimeout(hide, HIDE_MS);
                }
            }}
        >
            <button
                ref={button}
                type="button"
                aria-label={label}
                aria-describedby={id}
                onFocus={show}
                onClick={show}
                onBlur={hide}
                className="relative grid size-(--tip-button) cursor-pointer place-items-center border-(length:--hairline) border-line text-(length:--fine-size) leading-none font-semibold text-text-muted before:absolute before:-inset-(--space-2) before:content-[''] hover:border-accent hover:text-accent"
            >
                ?
            </button>
            <span
                id={id}
                role="tooltip"
                hidden={!open}
                className="absolute top-full left-0 z-20 mt-(--space-1) w-max max-w-[min(var(--tip-width),100%)] border-(length:--hairline) border-line bg-surface px-(--space-3) py-(--space-2) text-(length:--fine-size) leading-(--fine-line) font-normal text-text"
            >
                {text}
            </span>
        </span>
    );
}
