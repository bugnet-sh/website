import { copy } from "../copy.ts";
import type { Scheduler } from "../schedule.ts";
import { el } from "./dom.ts";

export type Clipboard = { writeText(s: string): Promise<void> };

// How long a copy button shows its outcome
export const COPIED_MS = 1_500;

// Long enough for the pointer to cross the gap between the ? and its text
export const TIP_HIDE_MS = 300;

// The page's status line for copy outcomes, outside #app, so it is there before its first message
export const ANNOUNCER_ID = "announcer";

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
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const show = () => {
        // A pending hide from the pointer leaving must not close a tip that focus just opened
        clearTimeout(hideTimer);
        if (!bubble.hidden) return;
        bubble.hidden = false;
        doc.addEventListener("keydown", onKey);
    };
    const hide = () => {
        clearTimeout(hideTimer);
        if (bubble.hidden) return;
        bubble.hidden = true;
        doc.removeEventListener("keydown", onKey);
    };
    button.addEventListener("focus", show);
    button.addEventListener("click", show);
    button.addEventListener("blur", hide);
    // The text is inside the tip, so the pointer reaching it enters the tip again in time
    root.addEventListener("mouseenter", show);
    root.addEventListener("mouseleave", () => {
        if (doc.activeElement !== button) hideTimer = setTimeout(hide, TIP_HIDE_MS);
    });
    return root;
}

type CopyState = "idle" | "copied" | "partial" | "failed" | "loading";

// The latest message's owner; a text match would let an earlier button clear a later identical one
let announced = 0;

function announce(doc: Document, text: string): number {
    const owner = ++announced;
    const line = doc.getElementById(ANNOUNCER_ID);
    if (line !== null) line.textContent = text;
    return owner;
}

function clearAnnouncement(doc: Document, owner: number): void {
    const line = doc.getElementById(ANNOUNCER_ID);
    if (line !== null && owner === announced) line.textContent = "";
}

export interface CopyChecks {
    // The accessible name, when the label alone would read the same as its neighbours'
    name?: string;
    // False when the text has not come yet; the click then starts loading it and copies nothing
    prepare?: () => boolean;
    // True when the text is only part of the whole, such as output cut short
    isPartial?: () => boolean;
}

// Every label stays in the button and the CSS shows one, so its width never changes
export function copyButton(
    doc: Document,
    label: string,
    getText: () => string,
    clipboard: Clipboard,
    scheduler?: Scheduler,
    checks: CopyChecks = {},
): HTMLButtonElement {
    const labels: [CopyState, HTMLSpanElement][] = [
        ["idle", el(doc, "span", { class: "copy-idle", text: label })],
        ["copied", el(doc, "span", { class: "copy-done", text: copy.copied })],
        ["partial", el(doc, "span", { class: "copy-partial", text: copy.copiedPartial })],
        ["failed", el(doc, "span", { class: "copy-failed", text: copy.copyFailed })],
        ["loading", el(doc, "span", { class: "copy-loading", text: copy.loading })],
    ];
    const attrs: Record<string, string> = { type: "button" };
    if (checks.name !== undefined) attrs["aria-label"] = checks.name;
    const button = el(
        doc,
        "button",
        { class: "copy-button", attrs },
        labels.map(([, span]) => span),
    );
    const apply = (state: CopyState) => {
        button.classList.toggle("is-copied", state === "copied");
        button.classList.toggle("is-partial", state === "partial");
        button.classList.toggle("is-failed", state === "failed");
        button.classList.toggle("is-loading", state === "loading");
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
    // The name stays put, so the outcome is said through the page's status line
    const flash = (state: CopyState) => {
        show(state);
        const said = labels.find(([shows]) => shows === state)![1].textContent ?? "";
        const owner = announce(doc, said);
        clearTimeout(timer);
        timer = setTimeout(() => {
            show("idle");
            clearAnnouncement(doc, owner);
        }, COPIED_MS);
    };
    button.addEventListener("click", () => {
        // A write after waiting for the text would fall outside the click, which browsers refuse
        if (checks.prepare?.() === false) {
            flash("loading");
            return;
        }
        clipboard.writeText(getText()).then(
            () => flash(checks.isPartial?.() ? "partial" : "copied"),
            // A silent failure would read as a copy, so the button says it failed
            () => flash("failed"),
        );
    });
    return button;
}
