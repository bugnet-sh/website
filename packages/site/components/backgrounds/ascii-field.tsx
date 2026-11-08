"use client";

import { useEffect, useState } from "react";
import GradientASCII, { type GradientASCIIProps, type GradientASCIIShape } from "./gradient-ascii";

/** The field's look the caller may tune; colours and the face always come from the tokens. */
type Tuning = Pick<GradientASCIIProps, "cellSize" | "flow" | "flicker" | "grain">;
import { WavesBoundary } from "../waves/error-boundary";

function hasWebGL2() {
    try {
        return Boolean(document.createElement("canvas").getContext("webgl2"));
    } catch {
        return false;
    }
}

/**
 * React Bits' Gradient ASCII in the brand's colours and mono face, as a backdrop the caller places.
 * It mounts after the fonts load, since its glyph atlas is drawn once in the face it is given.
 * Without WebGL 2 the slot stays empty; the component pauses offscreen and holds still under
 * reduced motion by itself.
 */
export function AsciiField({
    className,
    shape = "horizon",
    tuning,
}: {
    className?: string;
    shape?: GradientASCIIShape;
    tuning?: Tuning;
}) {
    const [look, setLook] = useState<{ colors: string[]; font: string } | null>(null);

    useEffect(() => {
        if (!hasWebGL2()) return;
        let live = true;
        void document.fonts.ready.then(() => {
            if (!live) return;
            const style = getComputedStyle(document.documentElement);
            const token = (name: string) => style.getPropertyValue(name).trim();
            setLook({
                colors: [token("--accent-3"), token("--accent"), token("--text")],
                // A canvas font names the face itself; it cannot read a custom property
                font: token("--font-mono"),
            });
        });
        return () => {
            live = false;
        };
    }, []);

    return (
        <div aria-hidden="true" className={className}>
            {look && (
                <WavesBoundary>
                    <GradientASCII
                        shape={shape}
                        colors={look.colors}
                        fontFamily={look.font}
                        gradientOpacity={0.35}
                        glyphOpacity={0.7}
                        mouseInteraction={false}
                        clickEffect="none"
                        {...tuning}
                    />
                </WavesBoundary>
            )}
        </div>
    );
}
