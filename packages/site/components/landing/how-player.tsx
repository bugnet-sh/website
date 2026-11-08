"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { STEP_MS, timeline, type Frame } from "./how-timeline";

// The bar's scale-x-0 sets the scale property, which a transform keyframe would not undo
const grow: Keyframe[] = [{ scale: "0 1" }, { scale: "1 1" }];

// The narrow breakpoint in globals.css, under which the four steps no longer sit in one row
const STACKED = "(max-width: 1080px)";

const parts = (root: HTMLElement) =>
    [...root.querySelectorAll<HTMLElement>("[data-how-step]")].map((step) => ({
        step,
        bar: step.querySelector<HTMLElement>("[data-how-bar]"),
        last: [...step.querySelectorAll<HTMLElement>("[data-how-line]")].at(-1),
    }));

/**
 * Every terminal stays drawn. In one row the steps light in turn while the list is on screen:
 * the number turns green, the bar sweeps the terminal's top, and a cursor sits on its last line.
 */
function play(root: HTMLElement): () => void {
    const steps = parts(root);
    const frames = timeline(steps.length);
    // The rest is the last frame, so the first advance lights step one at once
    let at = frames.length - 1;
    let left = 0;
    let due = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let bar: Animation | undefined;
    let onScreen = false;

    const show = (frame: Frame) => {
        steps.forEach(({ step, last }, i) => {
            step.toggleAttribute("data-playing", frame.step === i);
            last?.toggleAttribute("data-caret", frame.step === i);
        });
        bar?.cancel();
        bar = steps[frame.step]?.bar?.animate?.(grow, {
            duration: frame.ms,
            easing: "linear",
            fill: "forwards",
        });
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
        sync();
    });
    observer.observe(root);
    document.addEventListener("visibilitychange", sync);

    return () => {
        observer.disconnect();
        document.removeEventListener("visibilitychange", sync);
        clearTimeout(timer);
        show({ step: -1, ms: 0 });
    };
}

/** Stacked, a visitor sees a step or two at a time, so each step lights once as it comes into view */
function playEach(root: HTMLElement): () => void {
    const steps = parts(root);
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const bars = new Set<Animation>();

    const light = ({ step, bar, last }: (typeof steps)[number]) => {
        step.toggleAttribute("data-playing", true);
        last?.toggleAttribute("data-caret", true);
        const sweep = bar?.animate?.(grow, { duration: STEP_MS, easing: "linear" });
        if (sweep) bars.add(sweep);
        const timer = setTimeout(() => {
            timers.delete(timer);
            step.toggleAttribute("data-playing", false);
            last?.toggleAttribute("data-caret", false);
        }, STEP_MS);
        timers.add(timer);
    };

    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                observer.unobserve(entry.target);
                const found = steps.find(({ step }) => step.contains(entry.target));
                if (found) light(found);
            }
        },
        { threshold: 0.5 },
    );
    steps.forEach(({ step }) => observer.observe(step.querySelector("[data-how-term]") ?? step));

    return () => {
        observer.disconnect();
        timers.forEach(clearTimeout);
        bars.forEach((bar) => bar.cancel());
        steps.forEach(({ step, last }) => {
            step.toggleAttribute("data-playing", false);
            last?.toggleAttribute("data-caret", false);
        });
    };
}

/**
 * The steps' list: in one row it lights them in order while it is on screen; stacked, each lights
 * as it comes into view. Every terminal is always drawn, and under reduced motion nothing lights.
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
