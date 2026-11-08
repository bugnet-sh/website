"use client";

import { useEffect, type ReactNode } from "react";

/** How many slides a key moves the deck, 0 for keys the deck leaves alone */
export function stepFor(key: string, shift: boolean): number {
    switch (key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
            return 1;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
            return -1;
        case " ":
            return shift ? -1 : 1;
        case "Home":
            return -Infinity;
        case "End":
            return Infinity;
        default:
            return 0;
    }
}

/** The index of the slide whose top edge is nearest the top of the screen */
function nearest(slides: HTMLElement[]): number {
    const offsets = slides.map((slide) => Math.abs(slide.getBoundingClientRect().top));
    return offsets.indexOf(Math.min(...offsets));
}

/** The slides, one to a screen, moved by the keys a presenter's clicker sends */
export function Deck({ children }: { children: ReactNode }) {
    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            const step = stepFor(event.key, event.shiftKey);
            const slides = [...document.querySelectorAll<HTMLElement>("[data-slide]")];
            if (step === 0 || slides.length === 0) return;
            const target = Math.min(slides.length - 1, Math.max(0, nearest(slides) + step));
            event.preventDefault();
            slides[target]?.scrollIntoView({ behavior: "instant", block: "start" });
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);
    return <main data-deck>{children}</main>;
}
