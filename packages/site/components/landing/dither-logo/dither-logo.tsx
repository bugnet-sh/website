"use client";

import { useEffect, useRef, useState } from "react";
import DitherVeil from "./dither-veil";
import { LogoBoundary } from "./error-boundary";
import { LOGO, logoSource } from "./logo-source";

/** The text colour, for a stylesheet without the token. */
const WHITE = "#ededed";
/** The veil's radius as a share of the drawn mark's height. */
const REVEAL = 0.24;

type Dither = { source: HTMLCanvasElement };

function hasWebGL2() {
    try {
        const gl = document.createElement("canvas").getContext("webgl2");
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
        return Boolean(gl);
    } catch {
        return false;
    }
}

/** The mark in white only (founder, 2026-11-08). */
function prepare(): Dither {
    const white =
        getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || WHITE;
    return { source: logoSource(white, white) };
}

function StaticLogo() {
    const [x, y, w, h] = LOGO.viewBox;
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`${x} ${y} ${w} ${h}`}
            className="block h-full w-full text-text"
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
 * The Bugnet mark drawn by a dither veil: white dots, and a wandering veil that shows the mark
 * smooth where it passes. It sits centred in its parent, at most `--dither-logo` tall, in a box of
 * the mark's own aspect: a wider box leaves a strip beside the mark that the veil reads as
 * outside the picture and paints. The plain mark stands in until the browser shows it can draw
 * the dither, and stays when it cannot.
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
            aria-hidden="true"
            data-testid="dither-logo"
            className={`absolute inset-0 grid place-items-center ${className ?? ""}`.trim()}
        >
            <div ref={slot} className="relative aspect-[608/693] h-[min(72%,var(--dither-logo))]">
                {dither && !failed ? (
                    <LogoBoundary fallback={<StaticLogo />}>
                        <DitherVeil
                            source={dither.source}
                            palette="tint"
                            pattern="floyd"
                            inkColor="transparent"
                            rim={0}
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
        </div>
    );
}
