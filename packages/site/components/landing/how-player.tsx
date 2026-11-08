"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { timeline, type Frame } from "./how-timeline";

// The bar's scale-x-0 sets the scale property, which a transform keyframe would not undo
const grow: Keyframe[] = [{ scale: "0 1" }, { scale: "1 1" }];

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

/** The steps' list, playing them in order while it is on screen, and still under reduced motion */
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
        return play(root);
    }, []);

    return (
        <ol ref={list} className={className}>
            {children}
        </ol>
    );
}
