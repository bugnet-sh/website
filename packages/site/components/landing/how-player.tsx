"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { LINE_MS, PAUSE_MS, timeline, type Frame } from "./how-timeline";

// The bar's scale-x-0 sets the scale property, which a transform keyframe would not undo
const grow: Keyframe[] = [{ scale: "0 1" }, { scale: "1 1" }];

// The narrow breakpoint in globals.css, under which the four steps no longer sit in one row
const STACKED = "(max-width: 1080px)";

/** Drives the server-drawn steps by attribute, and returns what stops it */
function play(root: HTMLElement): () => void {
    const steps = [...root.querySelectorAll<HTMLElement>("[data-how-step]")];
    const lines = steps.map((s) => [...s.querySelectorAll<HTMLElement>("[data-how-line]")]);
    const bars = steps.map((s) => s.querySelector<HTMLElement>("[data-how-bar]"));
    const frames = timeline(lines.map((l) => l.length));
    const hold = frames.length - 2;
    const clear = frames.length - 1;

    // The server drew every line, which is the hold, so the story starts there with no flash
    let at = hold;
    let left = frames[at]!.ms;
    let due = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let bar: Animation | undefined;
    let onScreen = false;
    let seen = false;

    const show = (frame: Frame) => {
        steps.forEach((step, i) => {
            step.toggleAttribute("data-playing", frame.step === i);
            lines[i]!.forEach((line, j) => {
                line.toggleAttribute("data-off", j >= frame.shown[i]!);
                line.toggleAttribute("data-caret", frame.step === i && j === frame.shown[i]! - 1);
            });
        });
        if (frame.bar !== undefined || frame.step < 0) {
            bar?.cancel();
            bar =
                frame.bar === undefined
                    ? undefined
                    : bars[frame.step]?.animate?.(grow, {
                          duration: frame.bar,
                          easing: "linear",
                          fill: "forwards",
                      });
        }
    };

    const schedule = () => {
        due = performance.now() + left;
        timer = setTimeout(advance, left);
    };
    const advance = () => {
        at = (at + 1) % frames.length;
        show(frames[at]!);
        left = frames[at]!.ms;
        schedule();
    };
    const sync = () => {
        const run = onScreen && !document.hidden;
        if (run && timer === undefined) {
            schedule();
            bar?.play();
        } else if (!run && timer !== undefined) {
            clearTimeout(timer);
            timer = undefined;
            left = Math.max(0, due - performance.now());
            bar?.pause();
        }
    };

    const observer = new IntersectionObserver(([entry]) => {
        onScreen = entry?.isIntersecting ?? false;
        // Off screen at first, the story waits cleared, so a visitor arrives at its first step
        if (!seen && !onScreen) {
            at = clear;
            left = frames[at]!.ms;
            show(frames[at]!);
        }
        seen = true;
        sync();
    });
    observer.observe(root);
    document.addEventListener("visibilitychange", sync);

    return () => {
        observer.disconnect();
        document.removeEventListener("visibilitychange", sync);
        clearTimeout(timer);
        show(frames[hold]!);
    };
}

/**
 * Stacked, a visitor sees a step or two at a time, so each terminal types its own lines once as
 * it comes into view, and then stays drawn. One on screen at first is already drawn and stays so.
 */
function playEach(root: HTMLElement): () => void {
    const steps = [...root.querySelectorAll<HTMLElement>("[data-how-step]")];
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const bars = new Set<Animation>();
    const waiting = new Set<HTMLElement>();
    const lines = (step: HTMLElement) => [...step.querySelectorAll<HTMLElement>("[data-how-line]")];
    const later = (ms: number, run: () => void) => {
        const timer = setTimeout(() => {
            timers.delete(timer);
            run();
        }, ms);
        timers.add(timer);
    };

    const type = (step: HTMLElement) => {
        const all = lines(step);
        step.toggleAttribute("data-playing", true);
        const bar = step.querySelector<HTMLElement>("[data-how-bar]")?.animate?.(grow, {
            duration: (all.length - 1) * LINE_MS + PAUSE_MS,
            easing: "linear",
        });
        if (bar) bars.add(bar);
        all.forEach((line, j) =>
            later(j * LINE_MS, () => {
                all[j - 1]?.toggleAttribute("data-caret", false);
                line.toggleAttribute("data-off", false);
                line.toggleAttribute("data-caret", true);
            }),
        );
        later((all.length - 1) * LINE_MS + PAUSE_MS, () => {
            all.at(-1)?.toggleAttribute("data-caret", false);
            step.toggleAttribute("data-playing", false);
        });
    };

    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                const step = entry.target.closest<HTMLElement>("[data-how-step]");
                if (!step) continue;
                if (entry.isIntersecting) {
                    observer.unobserve(entry.target);
                    if (waiting.delete(step)) type(step);
                } else if (!waiting.has(step)) {
                    waiting.add(step);
                    lines(step).forEach((line) => line.toggleAttribute("data-off", true));
                }
            }
        },
        { threshold: 0.5 },
    );
    steps.forEach((step) => observer.observe(step.querySelector("[data-how-term]") ?? step));

    return () => {
        observer.disconnect();
        timers.forEach(clearTimeout);
        bars.forEach((bar) => bar.cancel());
        steps.forEach((step) => {
            step.toggleAttribute("data-playing", false);
            lines(step).forEach((line) => {
                line.toggleAttribute("data-off", false);
                line.toggleAttribute("data-caret", false);
            });
        });
    };
}

/**
 * The steps' list: in one row it plays them in order while it is on screen; stacked, each plays
 * as it comes into view. Under reduced motion every terminal stays drawn.
 */
export function HowPlayer({ className, children }: { className: string; children: ReactNode }) {
    const list = useRef<HTMLOListElement>(null);

    useEffect(() => {
        const root = list.current;
        if (
            !root ||
            typeof IntersectionObserver === "undefined" ||
            (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false)
        ) {
            return;
        }
        const stacked = window.matchMedia?.(STACKED);
        const start = () => (stacked?.matches ? playEach(root) : play(root));
        let stop = start();
        const swap = () => {
            stop();
            stop = start();
        };
        stacked?.addEventListener?.("change", swap);
        return () => {
            stacked?.removeEventListener?.("change", swap);
            stop();
        };
    }, []);

    return (
        <ol ref={list} className={className}>
            {children}
        </ol>
    );
}
