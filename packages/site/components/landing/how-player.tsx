"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { timeline, typed, typing, type Frame, type Line } from "./how-timeline";

// The bar's scale-x-0 sets the scale property, which a transform keyframe would not undo
const grow: Keyframe[] = [{ scale: "0 1" }, { scale: "1 1" }];

// The narrow breakpoint in globals.css, under which the four steps no longer sit in one row
const STACKED = "(max-width: 1080px)";

/** A step's terminal: it shows one shot of its typing, or rests fully drawn */
function terminal(step: HTMLElement) {
    const lines = [...step.querySelectorAll<HTMLElement>("[data-how-line]")].map((el) => ({
        el,
        runs: [...el.children].map((run) => ({
            el: run as HTMLElement,
            text: run.textContent ?? "",
        })),
    }));

    /** Lines before `line` drawn, `chars` of line `line` and the cursor, the rest not there yet */
    const show = (line: number, chars: number) => {
        lines.forEach(({ el, runs }, j) => {
            el.toggleAttribute("data-off", j > line);
            el.toggleAttribute("data-caret", j === line);
            // Each coloured run keeps its span and shows as much of itself as the count reaches
            let left = j === line ? chars : Infinity;
            for (const run of runs) {
                const text = run.text.slice(0, Math.max(0, left));
                if (run.el.textContent !== text) run.el.textContent = text;
                left -= run.text.length;
            }
        });
    };

    return {
        step,
        bar: step.querySelector<HTMLElement>("[data-how-bar]"),
        light: () => step.toggleAttribute("data-playing", true),
        show,
        rest: () => {
            step.toggleAttribute("data-playing", false);
            show(Infinity, 0);
        },
    };
}

type Terminal = ReturnType<typeof terminal>;

const terminals = (root: HTMLElement) =>
    [...root.querySelectorAll<HTMLElement>("[data-how-step]")].map(terminal);

/**
 * In one row, the steps play in turn while the list is on screen and the tab is visible: the
 * playing step's number turns green, its bar sweeps as long as its terminal types, and its
 * terminal fills from empty. Every other terminal stays drawn. After the fourth, a rest.
 */
function play(root: HTMLElement, lines: readonly (readonly Line[])[]): () => void {
    const steps = terminals(root);
    const frames = timeline(lines);
    // The rest is the last frame, so the first advance plays step one at once
    let at = frames.length - 1;
    let lit: Terminal | undefined;
    let left = 0;
    let due = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let bar: Animation | undefined;
    let onScreen = false;

    const show = (frame: Frame) => {
        const next = steps[frame.step];
        if (next !== lit) {
            lit?.rest();
            bar?.cancel();
            bar = undefined;
            lit = next;
            lit?.light();
        }
        if (frame.bar !== undefined) {
            bar = lit?.bar?.animate?.(grow, {
                duration: frame.bar,
                easing: "linear",
                fill: "forwards",
            });
        }
        lit?.show(frame.line, frame.chars);
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
        bar?.cancel();
        steps.forEach((step) => step.rest());
    };
}

/**
 * Stacked, a visitor sees a step or two at a time, so each terminal types once as it comes into
 * view. One types at a time, in order, and one waiting its turn stays drawn.
 */
function playEach(root: HTMLElement, lines: readonly (readonly Line[])[]): () => void {
    const steps = terminals(root);
    const watched = steps.map(({ step }) => step.querySelector("[data-how-term]") ?? step);
    const inView = new Set<number>();
    const done = new Set<number>();
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let sweep: Animation | undefined;

    const next = () => {
        const i = steps.findIndex((_, i) => inView.has(i) && !done.has(i));
        const step = steps[i];
        busy = step !== undefined;
        if (!step) return;
        const shots = typing(lines[i] ?? []);
        step.light();
        sweep = step.bar?.animate?.(grow, {
            duration: typed(shots),
            easing: "linear",
            fill: "forwards",
        });
        const shoot = (k: number) => {
            const shot = shots[k];
            if (!shot) {
                sweep?.cancel();
                step.rest();
                done.add(i);
                observer.unobserve(watched[i]!);
                next();
                return;
            }
            step.show(shot.line, shot.chars);
            timer = setTimeout(() => shoot(k + 1), shot.ms);
        };
        shoot(0);
    };

    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                const i = watched.indexOf(entry.target);
                if (entry.isIntersecting) inView.add(i);
                else inView.delete(i);
            }
            if (!busy) next();
        },
        { threshold: 0.5 },
    );
    watched.forEach((term) => observer.observe(term));

    return () => {
        observer.disconnect();
        clearTimeout(timer);
        sweep?.cancel();
        steps.forEach((step) => step.rest());
    };
}

/**
 * The steps' list. In one row it plays them in order while it is on screen; stacked, each plays
 * as it comes into view. Only the playing terminal types, every other one stays drawn, and under
 * reduced motion nothing moves.
 */
export function HowPlayer({
    className,
    lines,
    children,
}: {
    className: string;
    /** Each step's terminal lines, in the order the list draws them */
    lines: readonly (readonly Line[])[];
    children: ReactNode;
}) {
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
        const start = () => (stacked?.matches ? playEach(root, lines) : play(root, lines));
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
    }, [lines]);

    return (
        <ol ref={list} className={className}>
            {children}
        </ol>
    );
}
