"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "../../lib/cx";

const SHOW_MS = 1500;

const words = { idle: "Copy", copied: "Copied", failed: "Copy failed" } as const;
type State = keyof typeof words;

/**
 * Copies the full text in one click. Every word sits in the same grid cell and only the current
 * one is visible, so the button is as wide as its longest word and a change moves nothing.
 */
export function CopyButton({ text, label }: { text: string; label: string }) {
    const [state, setState] = useState<State>("idle");
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => () => clearTimeout(timer.current), []);

    const copy = async () => {
        let next: State = "copied";
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            next = "failed";
        }
        clearTimeout(timer.current);
        setState(next);
        timer.current = setTimeout(() => setState("idle"), SHOW_MS);
    };

    return (
        <>
            <button
                type="button"
                aria-label={label}
                onClick={() => void copy()}
                className={cx(
                    "grid h-(--segment) cursor-pointer items-center border-(length:--hairline) border-line px-(--space-2) font-ui text-(length:--fine-size) leading-(--fine-line) whitespace-nowrap hover:border-accent hover:text-accent",
                    { idle: "text-text-muted", copied: "text-accent", failed: "text-warn" }[state],
                )}
            >
                {(Object.keys(words) as State[]).map((key) => (
                    <span
                        key={key}
                        aria-hidden
                        className={cx("[grid-area:1/1]", key !== state && "invisible")}
                    >
                        {words[key]}
                    </span>
                ))}
            </button>
            {/* The words above are hidden from screen readers, so the outcome is announced here */}
            <span role="status" className="sr-only">
                {state === "idle" ? "" : words[state]}
            </span>
        </>
    );
}
