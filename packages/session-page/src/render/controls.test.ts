// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "../copy.ts";
import type { Scheduler } from "../schedule.ts";
import { copyButton, tip } from "./controls.ts";

function mount(text = "Nothing loads until you click.", label = "About this page") {
    const root = tip(document, text, label);
    document.body.replaceChildren(root);
    const button = root.querySelector("button")!;
    const bubble = root.querySelector<HTMLElement>('[role="tooltip"]')!;
    return { root, button, bubble };
}

const key = (target: EventTarget, k: string) =>
    target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

describe("tip", () => {
    it("shows on focus, hides on Escape, and describes its button", () => {
        const { button, bubble } = mount();
        expect(bubble.textContent).toBe("Nothing loads until you click.");
        expect(bubble.id).not.toBe("");
        expect(button.getAttribute("aria-describedby")).toBe(bubble.id);
        expect(bubble.hidden).toBe(true);
        button.focus();
        expect(bubble.hidden).toBe(false);
        key(button, "Escape");
        expect(bubble.hidden).toBe(true);
    });

    it("shows on hover and on click, and hides on blur or when the pointer leaves", () => {
        const { root, button, bubble } = mount();
        root.dispatchEvent(new MouseEvent("mouseenter"));
        expect(bubble.hidden).toBe(false);
        root.dispatchEvent(new MouseEvent("mouseleave"));
        expect(bubble.hidden).toBe(true);
        button.click();
        expect(bubble.hidden).toBe(false);
        button.focus();
        button.blur();
        expect(bubble.hidden).toBe(true);
    });

    it("closes on Escape anywhere while shown by hover", () => {
        const { root, bubble } = mount();
        root.dispatchEvent(new MouseEvent("mouseenter"));
        key(document.body, "Escape");
        expect(bubble.hidden).toBe(true);
    });

    it("is a round ? button named by its label, with its own tooltip id", () => {
        const { button } = mount("a", "About this page");
        expect(button.type).toBe("button");
        expect(button.textContent).toBe(copy.tipMark);
        expect(button.getAttribute("aria-label")).toBe("About this page");
        const other = tip(document, "b", "About the map");
        expect(other.querySelector("button")!.getAttribute("aria-label")).toBe("About the map");
        expect(other.querySelector('[role="tooltip"]')!.id).not.toBe(
            button.getAttribute("aria-describedby"),
        );
    });

    it("stops listening on the document once the page has dropped the tip", () => {
        const add = vi.spyOn(document, "addEventListener");
        const remove = vi.spyOn(document, "removeEventListener");
        try {
            const { root, bubble } = mount();
            root.dispatchEvent(new MouseEvent("mouseenter"));
            const listener = add.mock.calls.find(([type]) => type === "keydown")![1];
            root.remove();
            key(document.body, "Tab");
            expect(remove).toHaveBeenCalledWith("keydown", listener);
            expect(bubble.hidden).toBe(true);
        } finally {
            add.mockRestore();
            remove.mockRestore();
        }
    });
});

describe("copyButton", () => {
    beforeEach(() => void vi.useFakeTimers());
    afterEach(() => void vi.useRealTimers());

    const board = () => ({ writeText: vi.fn(async (_text: string) => {}) });
    const visible = (b: HTMLButtonElement) =>
        [...b.children].filter((c) => c.getAttribute("aria-hidden") !== "true")[0]!.textContent;

    it("copies getText() at click time and shows Copied for 1,500 ms", async () => {
        const clipboard = board();
        let text = "first";
        const button = copyButton(document, copy.copySignature, () => text, clipboard);
        expect(button.type).toBe("button");
        expect(visible(button)).toBe(copy.copySignature);
        text = "second";
        button.click();
        await vi.advanceTimersByTimeAsync(0);
        expect(clipboard.writeText).toHaveBeenCalledExactlyOnceWith("second");
        expect(button.classList.contains("is-copied")).toBe(true);
        expect(visible(button)).toBe(copy.copied);
        await vi.advanceTimersByTimeAsync(1_499);
        expect(button.classList.contains("is-copied")).toBe(true);
        await vi.advanceTimersByTimeAsync(1);
        expect(button.classList.contains("is-copied")).toBe(false);
        expect(visible(button)).toBe(copy.copySignature);
    });

    it("holds all three labels at all times, so its width never changes", async () => {
        const button = copyButton(document, copy.copyOutput, () => "x", board());
        const labels = () => [...button.children].map((c) => c.textContent);
        const all = [copy.copyOutput, copy.copied, copy.copyFailed];
        expect(labels()).toEqual(all);
        button.click();
        await vi.advanceTimersByTimeAsync(0);
        expect(labels()).toEqual(all);
        expect(button.textContent).toBe(all.join(""));
    });

    it("restarts the 1,500 ms on a second click", async () => {
        const button = copyButton(document, copy.copyOutput, () => "x", board());
        button.click();
        await vi.advanceTimersByTimeAsync(1_000);
        button.click();
        await vi.advanceTimersByTimeAsync(1_000);
        expect(button.classList.contains("is-copied")).toBe(true);
        await vi.advanceTimersByTimeAsync(500);
        expect(button.classList.contains("is-copied")).toBe(false);
    });

    it("says Copy failed for 1,500 ms when the clipboard refuses, never Copied", async () => {
        const clipboard = { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) };
        const button = copyButton(document, copy.copyOutput, () => "x", clipboard);
        button.click();
        await vi.advanceTimersByTimeAsync(0);
        expect(button.classList.contains("is-copied")).toBe(false);
        expect(button.classList.contains("is-failed")).toBe(true);
        expect(visible(button)).toBe(copy.copyFailed);
        await vi.advanceTimersByTimeAsync(1_499);
        expect(visible(button)).toBe(copy.copyFailed);
        await vi.advanceTimersByTimeAsync(1);
        expect(button.classList.contains("is-failed")).toBe(false);
        expect(visible(button)).toBe(copy.copyOutput);
    });

    it("shows only the latest outcome when a copy follows a failed one", async () => {
        const clipboard = { writeText: vi.fn(async (_text: string) => {}) };
        clipboard.writeText.mockRejectedValueOnce(new Error("denied"));
        const button = copyButton(document, copy.copyOutput, () => "x", clipboard);
        button.click();
        await vi.advanceTimersByTimeAsync(1_000);
        button.click();
        await vi.advanceTimersByTimeAsync(0);
        expect(button.classList.contains("is-failed")).toBe(false);
        expect(visible(button)).toBe(copy.copied);
        await vi.advanceTimersByTimeAsync(1_000);
        expect(visible(button)).toBe(copy.copied);
        await vi.advanceTimersByTimeAsync(500);
        expect(visible(button)).toBe(copy.copyOutput);
    });

    it("changes its look inside the scheduler's frames when given one", async () => {
        const queue: (() => void)[] = [];
        const scheduler: Scheduler = { frame: (cb) => void queue.push(cb) };
        const button = copyButton(document, copy.copyOutput, () => "x", board(), scheduler);
        button.click();
        await vi.advanceTimersByTimeAsync(0);
        expect(button.classList.contains("is-copied")).toBe(false);
        queue.splice(0).forEach((cb) => cb());
        expect(button.classList.contains("is-copied")).toBe(true);
        await vi.advanceTimersByTimeAsync(1_500);
        expect(button.classList.contains("is-copied")).toBe(true);
        queue.splice(0).forEach((cb) => cb());
        expect(button.classList.contains("is-copied")).toBe(false);
    });
});
