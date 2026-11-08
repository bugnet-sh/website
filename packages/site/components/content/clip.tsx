"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** How much of a clip must be on screen for it to play. */
const IN_VIEW = 0.5;

/** Plays a clip that is on screen, unless the reader paused it or asks for less motion. */
function playOrPause(el: HTMLVideoElement, seen: boolean, chosen: boolean | undefined): void {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (seen && (chosen ?? !still)) el.play().catch(() => undefined);
    else el.pause();
}

/**
 * A short silent clip in a titled frame: `<name>.mp4` with its `<name>.webm` and `<name>.jpg`
 * poster beside it. It loops while at least half of it is on screen and pauses when it leaves.
 * Under reduced motion it stays on its poster until clicked; once the reader plays or pauses it,
 * that choice holds.
 */
export function Clip({ src, title }: { src: string; title: string }) {
    const base = src.replace(/\.mp4$/, "");
    const video = useRef<HTMLVideoElement>(null);
    const chosen = useRef<boolean | undefined>(undefined);
    const [playing, setPlaying] = useState(false);

    useEffect(() => {
        const el = video.current;
        if (!el) return;
        // React sets `muted` as a property only, and a browser plays on its own only when muted
        el.muted = true;
        const observer = new IntersectionObserver(
            (entries) => {
                const seen = (entries.at(-1)?.intersectionRatio ?? 0) >= IN_VIEW;
                playOrPause(el, seen, chosen.current);
            },
            { threshold: [0, IN_VIEW] },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const toggle = () => {
        const el = video.current;
        if (!el) return;
        chosen.current = el.paused;
        if (el.paused) el.play().catch(() => undefined);
        else el.pause();
    };

    return (
        <figure className="mt-(--prose-gap) border-(length:--hairline) border-line bg-surface first:mt-0">
            <figcaption className="border-b-(length:--hairline) border-line px-(--space-4) py-(--space-2) text-(length:--fine-size) leading-(--fine-line) tracking-(--caps-tracking) text-text-muted uppercase">
                {title}
            </figcaption>
            <div className="relative">
                <video
                    ref={video}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    poster={`${base}.jpg`}
                    aria-label={title}
                    onClick={toggle}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    className="block h-auto w-full cursor-pointer"
                >
                    <source src={`${base}.webm`} type="video/webm" />
                    <source src={src} type="video/mp4" />
                </video>
                <button
                    type="button"
                    aria-label={playing ? "Pause" : "Play"}
                    onClick={toggle}
                    className="absolute right-(--space-3) bottom-(--space-3) grid size-(--clip-button) cursor-pointer place-items-center border-(length:--hairline) border-line bg-bg text-text-muted hover:border-accent hover:text-accent"
                >
                    {playing ? (
                        <Pause aria-hidden="true" className="block size-(--copy-icon)" />
                    ) : (
                        <Play aria-hidden="true" className="block size-(--copy-icon)" />
                    )}
                </button>
            </div>
        </figure>
    );
}
