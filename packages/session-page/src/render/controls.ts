import { copy } from "../copy.ts";
import type { Scheduler } from "../schedule.ts";
import { el } from "./dom.ts";

export type Clipboard = { writeText(s: string): Promise<void> };

// How long a copy button shows its outcome
export const COPIED_MS = 1_500;

let tips = 0;

// The tooltip is absolutely placed by the page's CSS, so showing it moves nothing
export function tip(doc: Document, text: string, label: string): HTMLElement {
    const id = `tip-${++tips}`;
    const bubble = el(doc, "span", { class: "tip-text", text, attrs: { role: "tooltip", id } });
    bubble.hidden = true;
    const button = el(doc, "button", {
        class: "tip-button",
        text: copy.tipMark,
        attrs: { type: "button", "aria-label": label, "aria-describedby": id },
    });
    const root = el(doc, "span", { class: "tip" }, [button, bubble]);

    // Listening on the document lets Escape close a tooltip shown by hover alone
    const onKey = (e: KeyboardEvent) => {
        // A re-render can drop a shown tip, which would otherwise keep this listener forever
        if (e.key === "Escape" || !button.isConnected) hide();
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

type CopyState = "idle" | "copied" | "failed";

// All three labels stay in the button and the CSS shows one, so its width never changes
export function copyButton(
    doc: Document,
    label: string,
    getText: () => string,
    clipboard: Clipboard,
    scheduler?: Scheduler,
): HTMLButtonElement {
    const labels: [CopyState, HTMLSpanElement][] = [
        ["idle", el(doc, "span", { class: "copy-idle", text: label })],
        ["copied", el(doc, "span", { class: "copy-done", text: copy.copied })],
        ["failed", el(doc, "span", { class: "copy-failed", text: copy.copyFailed })],
    ];
    const button = el(
        doc,
        "button",
        { class: "copy-button", attrs: { type: "button" } },
        labels.map(([, span]) => span),
    );
    const apply = (state: CopyState) => {
        button.classList.toggle("is-copied", state === "copied");
        button.classList.toggle("is-failed", state === "failed");
        for (const [shows, span] of labels) {
            if (shows === state) span.removeAttribute("aria-hidden");
            else span.setAttribute("aria-hidden", "true");
        }
    };
    const show = (state: CopyState) => {
        if (scheduler) scheduler.frame(() => apply(state));
        else apply(state);
    };
    apply("idle");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flash = (state: CopyState) => {
        show(state);
        clearTimeout(timer);
        timer = setTimeout(() => show("idle"), COPIED_MS);
    };
    button.addEventListener("click", () => {
        clipboard.writeText(getText()).then(
            () => flash("copied"),
            // A silent failure would read as a copy, so the button says it failed
            () => flash("failed"),
        );
    });
    return button;
}
