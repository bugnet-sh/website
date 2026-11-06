import { copy } from "../copy.ts";
import type { Scheduler } from "../schedule.ts";
import { el } from "./dom.ts";

export type Clipboard = { writeText(s: string): Promise<void> };

const COPIED_MS = 1_500;

let tips = 0;

// The tooltip is absolutely placed by the page's CSS, so showing it moves nothing
export function tip(doc: Document, text: string, label?: string): HTMLElement {
    const id = `tip-${++tips}`;
    const bubble = el(doc, "span", { class: "tip-text", text, attrs: { role: "tooltip", id } });
    bubble.hidden = true;
    const attrs: Record<string, string> = { type: "button", "aria-describedby": id };
    if (label !== undefined) attrs["aria-label"] = label;
    const button = el(doc, "button", { class: "tip-button", text: "?", attrs });
    const root = el(doc, "span", { class: "tip" }, [button, bubble]);

    // Listening on the document lets Escape close a tooltip shown by hover alone
    const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") hide();
    };
    const show = () => {
        if (!bubble.hidden) return;
        bubble.hidden = false;
        doc.addEventListener("keydown", onKey);
    };
    const hide = () => {
        if (bubble.hidden) return;
        bubble.hidden = true;
        doc.removeEventListener("keydown", onKey);
    };
    button.addEventListener("focus", show);
    button.addEventListener("click", show);
    button.addEventListener("blur", hide);
    root.addEventListener("mouseenter", show);
    root.addEventListener("mouseleave", () => {
        if (doc.activeElement !== button) hide();
    });
    return root;
}

// Both labels stay in the button and the CSS shows one, so its width never changes
export function copyButton(
    doc: Document,
    label: string,
    getText: () => string,
    clipboard: Clipboard,
    scheduler?: Scheduler,
): HTMLButtonElement {
    const idle = el(doc, "span", { class: "copy-idle", text: label });
    const done = el(doc, "span", {
        class: "copy-done",
        text: copy.copied,
        attrs: { "aria-hidden": "true" },
    });
    const button = el(doc, "button", { class: "copy-button", attrs: { type: "button" } }, [
        idle,
        done,
    ]);
    const show = (copied: boolean) => {
        const run = () => {
            button.classList.toggle("is-copied", copied);
            (copied ? done : idle).removeAttribute("aria-hidden");
            (copied ? idle : done).setAttribute("aria-hidden", "true");
        };
        if (scheduler) scheduler.frame(run);
        else run();
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    button.addEventListener("click", () => {
        clipboard.writeText(getText()).then(
            () => {
                show(true);
                clearTimeout(timer);
                timer = setTimeout(() => show(false), COPIED_MS);
            },
            // A refused clipboard leaves the label as it was, so nothing claims a copy
            () => {},
        );
    });
    return button;
}
