"use client";

import { useEffect, useRef, useState } from "react";
import DitherVeil from "./dither-veil";
import { LogoBoundary } from "./error-boundary";
import { LOGO, logoSource } from "./logo-source";

/** The third accent, for a stylesheet without the token. */
const ACCENT_3 = "#b4a4ff";
/** The veil's radius as a share of the drawn mark's height. */
const REVEAL = 0.24;

type Dither = { source: HTMLCanvasElement; rim: string };

function hasWebGL2() {
    try {
        const gl = document.createElement("canvas").getContext("webgl2");
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
        return Boolean(gl);
    } catch {
        return false;
    }
}

function prepare(): Dither {
    const style = getComputedStyle(document.documentElement);
    const accent = style.getPropertyValue("--accent").trim();
    const accent3 = style.getPropertyValue("--accent-3").trim() || ACCENT_3;
    return { source: logoSource(accent, accent3), rim: accent3 };
}

function StaticLogo() {
    const [x, y, w, h] = LOGO.viewBox;
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`${x} ${y} ${w} ${h}`}
            className="block h-full w-full text-accent"
            focusable="false"
            data-testid="static-logo"
        >
            <g fill="currentColor">
                {LOGO.strokes.map((d) => (
                    <path
                        key={d}
                        d={d}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={LOGO.strokeWidth}
                        strokeLinecap="round"
                    />
                ))}
                {LOGO.circles.map(([cx, cy, r]) => (
                    <circle key={cx} cx={cx} cy={cy} r={r} />
                ))}
                <path fillRule="evenodd" d={LOGO.head} />
                {LOGO.wings.map((d) => (
                    <path key={d} d={d} />
                ))}
            </g>
        </svg>
    );
}

/**
 * The Bugnet mark drawn by a dither veil: dots in the accent shading into the third accent, a
 * wandering veil that shows the mark smooth where it passes. It fills its parent and keeps the
 * mark's aspect. The plain mark stands in until the browser shows it can draw the dither, and
 * stays when it cannot.
 */
export function DitherLogo({ className }: { className?: string }) {
    const slot = useRef<HTMLDivElement>(null);
    const [dither, setDither] = useState<Dither | null>(null);
    const [failed, setFailed] = useState(false);
    const [reduced, setReduced] = useState(false);
    const [onScreen, setOnScreen] = useState(true);
    const [tabHidden, setTabHidden] = useState(false);
    const [markHeight, setMarkHeight] = useState(0);

    useEffect(() => {
        if (hasWebGL2()) {
            try {
                setDither(prepare());
            } catch {
                setFailed(true);
            }
        }
        setReduced(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
        const onVisibility = () => setTabHidden(document.hidden);
        document.addEventListener("visibilitychange", onVisibility);
        const intersection =
            typeof IntersectionObserver === "undefined"
                ? null
                : new IntersectionObserver(
                      (entries) => setOnScreen(entries.some((e) => e.isIntersecting)),
                      { threshold: 0 },
                  );
        const [, , w, h] = LOGO.viewBox;
        const resize =
            typeof ResizeObserver === "undefined"
                ? null
                : new ResizeObserver(([entry]) => {
                      const box = entry?.contentRect;
                      if (box) setMarkHeight(Math.min(box.height, (box.width * h) / w));
                  });
        if (slot.current) {
            intersection?.observe(slot.current);
            resize?.observe(slot.current);
        }
        return () => {
            document.removeEventListener("visibilitychange", onVisibility);
            intersection?.disconnect();
            resize?.disconnect();
        };
    }, []);

    return (
        <div
            ref={slot}
            aria-hidden="true"
            data-testid="dither-logo"
            className={`relative h-full w-full ${className ?? ""}`.trim()}
        >
            {dither && !failed ? (
                <LogoBoundary fallback={<StaticLogo />}>
                    <DitherVeil
                        source={dither.source}
                        palette="tint"
                        pattern="floyd"
                        inkColor="transparent"
                        rimColor={dither.rim}
                        rim={0.3}
                        contrast={1}
                        pixelSize={2}
                        revealRadius={Math.max(40, Math.round(markHeight * REVEAL))}
                        wander
                        maxDpr={1.5}
                        intro={!reduced}
                        paused={reduced || !onScreen || tabHidden}
                        onError={() => setFailed(true)}
                    />
                </LogoBoundary>
            ) : (
                <StaticLogo />
            )}
        </div>
    );
}
