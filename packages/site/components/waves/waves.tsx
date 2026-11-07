"use client";

import { useEffect, useRef, useState } from "react";
import { WavesBoundary } from "./error-boundary";
import SlicedWaves from "./sliced-waves";

type Colors = { color1: string; color2: string; color3: string };

function hasWebGL() {
    try {
        const canvas = document.createElement("canvas");
        return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
        return false;
    }
}

function readColors(): Colors {
    const style = getComputedStyle(document.documentElement);
    const token = (name: string) => style.getPropertyValue(name).trim();
    return {
        color1: token("--accent"),
        color2: token("--waves-mid"),
        color3: token("--accent-2"),
    };
}

/**
 * The footer's closing band: sliced waves rail to rail at a fixed height, so nothing moves when
 * they load. Everything the browser can refuse (WebGL, motion) is decided after mount, so the
 * static export and a failed start both leave an empty slot.
 */
export function FooterWaves() {
    const slot = useRef<HTMLDivElement>(null);
    const [colors, setColors] = useState<Colors | null>(null);
    const [reduced, setReduced] = useState(false);
    const [onScreen, setOnScreen] = useState(true);
    const [tabHidden, setTabHidden] = useState(false);

    useEffect(() => {
        if (hasWebGL()) setColors(readColors());
        setReduced(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
        const onVisibility = () => setTabHidden(document.hidden);
        document.addEventListener("visibilitychange", onVisibility);
        const observer =
            typeof IntersectionObserver === "undefined"
                ? null
                : new IntersectionObserver(
                      (entries) => setOnScreen(entries.some((e) => e.isIntersecting)),
                      { threshold: 0 },
                  );
        if (slot.current) observer?.observe(slot.current);
        return () => {
            document.removeEventListener("visibilitychange", onVisibility);
            observer?.disconnect();
        };
    }, []);

    return (
        <div
            ref={slot}
            data-testid="waves-slot"
            aria-hidden="true"
            className="pointer-events-none h-(--waves)"
        >
            {colors && (
                <WavesBoundary>
                    <SlicedWaves
                        {...colors}
                        mouseInteraction={false}
                        // A paused component still draws one frame, which is the reduced-motion still
                        intro={!reduced}
                        paused={reduced || !onScreen || tabHidden}
                    />
                </WavesBoundary>
            )}
        </div>
    );
}
