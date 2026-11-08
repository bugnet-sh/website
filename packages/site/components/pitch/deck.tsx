"use client";

import { Children, useEffect, useState, type ReactNode } from "react";

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

/**
 * Turns wheel events into slide steps, one step per gesture. A trackpad keeps firing smaller and
 * smaller events after the fingers lift, so a gesture ends only after a quiet gap, or when a
 * sharply larger event shows a new swipe has begun.
 */
export function wheelPager({ gap = 180, threshold = 24, lock = 650 } = {}) {
    let last = -Infinity;
    let lastSize = 0;
    let sum = 0;
    let used = false;
    let lockedUntil = -Infinity;
    return (delta: number, now: number): number => {
        const size = Math.abs(delta);
        if (now - last > gap || (size > 20 && size > lastSize * 2)) {
            sum = 0;
            used = false;
        }
        last = now;
        lastSize = size;
        sum += delta;
        if (used || now < lockedUntil || Math.abs(sum) < threshold) return 0;
        used = true;
        lockedUntil = now + lock;
        return Math.sign(sum);
    };
}

const PAGED = "(min-width: 721px)";

/** The slides, one to a screen; a scroll, swipe or key glides to the next one and stops there */
export function Deck({ children }: { children: ReactNode }) {
    const slides = Children.toArray(children);
    const count = slides.length;
    const [index, setIndex] = useState(0);
    const [paged, setPaged] = useState(false);

    useEffect(() => {
        const media = window.matchMedia(PAGED);
        const sync = () => setPaged(media.matches);
        sync();
        media.addEventListener("change", sync);
        const n = Number(window.location.hash.slice(1));
        if (Number.isInteger(n) && n >= 1 && n <= count) setIndex(n - 1);
        return () => media.removeEventListener("change", sync);
    }, [count]);

    useEffect(() => {
        if (paged) window.history.replaceState(null, "", `#${index + 1}`);
    }, [index, paged]);

    useEffect(() => {
        if (!paged) return;
        const go = (step: number) => setIndex((i) => Math.min(count - 1, Math.max(0, i + step)));
        const wheel = wheelPager();
        let touchY: number | null = null;

        function onWheel(event: WheelEvent) {
            // A pinch zooms the page, which the browser reports as a wheel event with Control
            if (event.ctrlKey) return;
            event.preventDefault();
            const scale = event.deltaMode === 1 ? 16 : 1;
            const delta =
                Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
            const step = wheel(delta * scale, event.timeStamp);
            if (step !== 0) go(step);
        }
        function onKey(event: KeyboardEvent) {
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            const step = stepFor(event.key, event.shiftKey);
            if (step === 0) return;
            event.preventDefault();
            go(step);
        }
        function onTouchStart(event: TouchEvent) {
            touchY = event.touches[0]?.clientY ?? null;
        }
        function onTouchEnd(event: TouchEvent) {
            const end = event.changedTouches[0]?.clientY;
            if (touchY !== null && end !== undefined && Math.abs(end - touchY) > 40) {
                go(end < touchY ? 1 : -1);
            }
            touchY = null;
        }

        window.addEventListener("wheel", onWheel, { passive: false });
        window.addEventListener("keydown", onKey);
        window.addEventListener("touchstart", onTouchStart, { passive: true });
        window.addEventListener("touchend", onTouchEnd);
        return () => {
            window.removeEventListener("wheel", onWheel);
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("touchstart", onTouchStart);
            window.removeEventListener("touchend", onTouchEnd);
        };
    }, [paged, count]);

    return (
        <main data-deck data-paged={paged || undefined}>
            <div
                className="deck-track"
                style={paged ? { transform: `translate3d(0, ${-index * 100}dvh, 0)` } : undefined}
            >
                {slides.map((slide, i) => (
                    <div key={i} className="deck-slot" inert={paged && i !== index}>
                        {slide}
                    </div>
                ))}
            </div>
        </main>
    );
}
