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

/** One slide step per wheel gesture; momentum, however it jumps, never starts a second until the wheel goes quiet */
export function wheelPager({ gap = 180, threshold = 24, lock = 800 } = {}) {
    let last = -Infinity;
    let sum = 0;
    let used = false;
    let lockedUntil = -Infinity;
    return (delta: number, now: number): number => {
        if (now - last > gap) {
            sum = 0;
            used = false;
        }
        last = now;
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
    // The glide stays off until the first slide is placed, so a shared #9 opens on slide 9
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const media = window.matchMedia(PAGED);
        const sync = () => setPaged(media.matches);
        sync();
        media.addEventListener("change", sync);
        const fromHash = () => {
            const n = Number(window.location.hash.slice(1));
            if (Number.isInteger(n) && n >= 1 && n <= count) setIndex(n - 1);
        };
        fromHash();
        const frame = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
        window.addEventListener("hashchange", fromHash);
        return () => {
            media.removeEventListener("change", sync);
            window.removeEventListener("hashchange", fromHash);
            cancelAnimationFrame(frame);
        };
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
        <main data-deck data-paged={paged || undefined} data-ready={ready || undefined}>
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
