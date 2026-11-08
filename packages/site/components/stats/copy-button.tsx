"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { CheckIcon, CopyIcon, FailIcon } from "../icons";
import { secondaryButton } from "../ui/button";

const SHOW_MS = 1500;

const words = { idle: "Copy", copied: "Copied", failed: "Copy failed" } as const;
type State = keyof typeof words;

const icons = { idle: CopyIcon, copied: CheckIcon, failed: FailIcon } as const;

const tone = { idle: "text-text-muted", copied: "text-accent", failed: "text-warn" } as const;

const small =
    "relative grid h-(--segment) items-center border-(length:--hairline) border-line font-ui text-(length:--fine-size) leading-(--fine-line) whitespace-nowrap before:absolute before:content-[''] hover:border-accent hover:text-accent";

// A 40 px tap target round each, as every other button has
const forms = {
    words: `${small} px-(--space-2) before:inset-x-0 before:-inset-y-[calc((var(--hit)-var(--segment))/2)]`,
    icon: `${small} w-(--segment) place-items-center before:-inset-[calc((var(--hit)-var(--segment))/2)]`,
    labelled: secondaryButton,
} as const;

/**
 * Copies the full text in one click. As words, every word sits in the same grid cell and only the
 * current one is visible, so the button is as wide as its longest word and a change moves
 * nothing. As an icon, it is a square a segment tall, as code blocks show it. Labelled, it is a
 * secondary button with the icon before the words, and its label is the word at rest.
 */
export function CopyButton({
    text,
    label,
    form = "words",
}: {
    text: string;
    label: string;
    form?: keyof typeof forms;
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
    const shown = form === "labelled" ? { ...words, idle: label } : words;
    return (
        <>
            <button
                type="button"
                aria-label={label}
                onClick={() => void copy()}
                className={cx("cursor-pointer", forms[form], form !== "labelled" && tone[state])}
            >
                {form !== "words" && <Icon />}
                {form !== "icon" && (
                    // Labelled, the word stays against its icon; alone, it is centred as before
                    <span className={cx("grid", form === "labelled" && "text-left")}>
                        {(Object.keys(shown) as State[]).map((key) => (
                            <span
                                key={key}
                                aria-hidden
                                className={cx("[grid-area:1/1]", key !== state && "invisible")}
                            >
                                {shown[key]}
                            </span>
                        ))}
                    </span>
                )}
            </button>
            {/* The words and icons above are hidden from screen readers, so the outcome is announced here */}
            <span role="status" className="sr-only">
                {state === "idle" ? "" : words[state]}
            </span>
        </>
    );
}
