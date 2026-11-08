"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { CheckIcon, CopyIcon, FailIcon } from "../icons";

const SHOW_MS = 1500;

const words = { idle: "Copy", copied: "Copied", failed: "Copy failed" } as const;
type State = keyof typeof words;

const icons = { idle: CopyIcon, copied: CheckIcon, failed: FailIcon } as const;

const tone = { idle: "text-text-muted", copied: "text-accent", failed: "text-warn" } as const;

/**
 * Copies the full text in one click. As words, every word sits in the same grid cell and only the
 * current one is visible, so the button is as wide as its longest word and a change moves
 * nothing. As an icon, it is a square a segment tall, as code blocks show it.
 */
export function CopyButton({
    text,
    label,
    icon = false,
}: {
    text: string;
    label: string;
    icon?: boolean;
}) {
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

    const Icon = icons[state];
    return (
        <>
            <button
                type="button"
                aria-label={label}
                onClick={() => void copy()}
                className={cx(
                    "relative grid h-(--segment) cursor-pointer items-center border-(length:--hairline) border-line font-ui text-(length:--fine-size) leading-(--fine-line) whitespace-nowrap before:absolute before:content-[''] hover:border-accent hover:text-accent",
                    // A 40 px tap target round the 28 px button, as every other button has
                    icon
                        ? "w-(--segment) place-items-center before:-inset-[calc((var(--hit)-var(--segment))/2)]"
                        : "px-(--space-2) before:inset-x-0 before:-inset-y-[calc((var(--hit)-var(--segment))/2)]",
                    tone[state],
                )}
            >
                {icon ? (
                    <Icon />
                ) : (
                    (Object.keys(words) as State[]).map((key) => (
                        <span
                            key={key}
                            aria-hidden
                            className={cx("[grid-area:1/1]", key !== state && "invisible")}
                        >
                            {words[key]}
                        </span>
                    ))
                )}
            </button>
            {/* The words and icons above are hidden from screen readers, so the outcome is announced here */}
            <span role="status" className="sr-only">
                {state === "idle" ? "" : words[state]}
            </span>
        </>
    );
}
