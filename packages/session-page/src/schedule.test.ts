// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createScheduler } from "./schedule.js";

function setup(hidden = false) {
    const doc = document.implementation.createHTMLDocument("");
    let isHidden = hidden;
    Object.defineProperty(doc, "hidden", { configurable: true, get: () => isHidden });
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => frames.push(cb));
    const scheduler = createScheduler(doc, window);
    return {
        doc,
        scheduler,
        requested: () => frames.length,
        tick() {
            for (const cb of frames.splice(0)) cb(0);
        },
        setHidden(value: boolean) {
            isHidden = value;
            doc.dispatchEvent(new Event("visibilitychange"));
        },
    };
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("createScheduler", () => {
    it("runs queued callbacks on the next animation frame", () => {
        const t = setup();
        const cb = vi.fn();
        t.scheduler.frame(cb);
        expect(cb).not.toHaveBeenCalled();
        t.tick();
        expect(cb).toHaveBeenCalledOnce();
    });

    it("runs the rest of a batch after one callback throws, and reports the error", () => {
        const reported = vi.fn();
        vi.stubGlobal("reportError", reported);
        const t = setup();
        const boom = new Error("render bug");
        const after = vi.fn();
        t.scheduler.frame(() => {
            throw boom;
        });
        t.scheduler.frame(after);
        t.tick();
        expect(after).toHaveBeenCalledOnce();
        expect(reported).toHaveBeenCalledExactlyOnceWith(boom);
    });

    it("runs a callback queued twice before a frame once", () => {
        const t = setup();
        const cb = vi.fn();
        t.scheduler.frame(cb);
        t.scheduler.frame(cb);
        expect(t.requested()).toBe(1);
        t.tick();
        expect(cb).toHaveBeenCalledOnce();
    });

    it("holds work while the tab is hidden and runs it when the tab shows again", () => {
        const t = setup(true);
        const html = t.doc.documentElement;
        expect(html.classList.contains("is-hidden-tab")).toBe(true);
        const cb = vi.fn();
        t.scheduler.frame(cb);
        expect(t.requested()).toBe(0);
        t.setHidden(false);
        expect(html.classList.contains("is-hidden-tab")).toBe(false);
        t.tick();
        expect(cb).toHaveBeenCalledOnce();
    });

    it("keeps a frame requested before the tab hid for when it shows again", () => {
        const t = setup();
        const cb = vi.fn();
        t.scheduler.frame(cb);
        t.setHidden(true);
        expect(t.doc.documentElement.classList.contains("is-hidden-tab")).toBe(true);
        t.tick();
        expect(cb).not.toHaveBeenCalled();
        t.setHidden(false);
        t.tick();
        expect(cb).toHaveBeenCalledOnce();
    });
});
