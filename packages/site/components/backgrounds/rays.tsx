"use client";

import { useEffect, useState } from "react";
import { WavesBoundary } from "../waves/error-boundary";
import LightRays from "./light-rays";

function hasWebGL2() {
    try {
        return Boolean(document.createElement("canvas").getContext("webgl2"));
    } catch {
        return false;
    }
}

/**
 * React Bits' Light Rays in white, falling from the top centre of the box the caller places it
 * in. The pointer moves nothing, and under reduced motion the rays stand still. Without WebGL 2
 * the box stays empty.
 */
export function Rays({ className }: { className?: string }) {
    const [ready, setReady] = useState<{ reduced: boolean } | null>(null);

    useEffect(() => {
        if (!hasWebGL2()) return;
        setReady({
            reduced: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
        });
    }, []);

    return (
        <div aria-hidden="true" className={className}>
            {ready && (
                <WavesBoundary>
                    <LightRays
                        raysColor="#ffffff"
                        followMouse={false}
                        cursorShadow={false}
                        clickPulse={false}
                        raysSpeed={ready.reduced ? 0 : 1}
                        // Half strength, so the rays light the band without glaring over the tabs
                        intensity={0.45}
                    />
                </WavesBoundary>
            )}
        </div>
    );
}
