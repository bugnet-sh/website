"use client";

import { useEffect, useRef, useState } from "react";
import DitherVeil from "./dither-veil";
import { LogoBoundary } from "./error-boundary";

/** The mark as a lit aluminium object on the page ground, as scripts/render-mark.mjs writes it. */
export const MARK = { src: "/mark.png", width: 999, height: 1200 };
/** The tokens' values, for a stylesheet without them. */
const INK = "#0a0a0a";
const PAPER = "#ededed";
/** The veil's radius as a share of the box's height, as z402's hero has it. */
const REVEAL = 0.32;

type Dither = { source: HTMLCanvasElement; ink: string; paper: string };
type Box = { width: number; height: number };

function hasWebGL2() {
    try {
        const gl = document.createElement("canvas").getContext("webgl2");
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
        return Boolean(gl);
    } catch {
        return false;
    }
}

function token(name: string, fallback: string) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function loadMark(): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const context = canvas.getContext("2d");
            if (!context) return reject(new Error("No 2D canvas"));
            context.drawImage(image, 0, 0);
            resolve(canvas);
        };
        image.onerror = () => reject(new Error(`${MARK.src} did not load`));
        image.src = MARK.src;
    });
}

function PlainMark() {
    return (
        <img
            src={MARK.src}
            width={MARK.width}
            height={MARK.height}
            alt=""
            loading="lazy"
            decoding="async"
            className="block h-full w-full"
            data-testid="plain-mark"
        />
    );
}

/**
 * The rendered mark under a dither veil: white dots on the page's ground, Bayer, and a wandering
 * veil that shows the smooth render where it passes. The picture's ground is the page's, so the
 * box never shows. It sits centred in its parent, at most `--dither-logo` tall, in a box of the
 * picture's aspect. The plain render stands in until the browser shows it can draw the dither,
 * and stays when it cannot.
 */
export function DitherLogo({ className }: { className?: string }) {
    const slot = useRef<HTMLDivElement>(null);
    const [dither, setDither] = useState<Dither | null>(null);
    const [failed, setFailed] = useState(false);
    const [reduced, setReduced] = useState(false);
    const [onScreen, setOnScreen] = useState(true);
    const [tabHidden, setTabHidden] = useState(false);
    const [box, setBox] = useState<Box | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (hasWebGL2()) {
            loadMark().then(
                (source) => {
                    if (cancelled) return;
                    setDither({ source, ink: token("--bg", INK), paper: token("--text", PAPER) });
                },
                () => {
                    if (!cancelled) setFailed(true);
                },
            );
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
        const resize =
            typeof ResizeObserver === "undefined"
                ? null
                : new ResizeObserver(([entry]) => {
                      const rect = entry?.contentRect;
                      if (!rect || rect.height <= 0) return;
                      setBox((b) =>
                          b?.width === rect.width && b.height === rect.height
                              ? b
                              : { width: rect.width, height: rect.height },
                      );
                  });
        if (slot.current) {
            intersection?.observe(slot.current);
            resize?.observe(slot.current);
        }
        return () => {
            cancelled = true;
            document.removeEventListener("visibilitychange", onVisibility);
            intersection?.disconnect();
            resize?.disconnect();
        };
    }, []);

    // The fit that makes the picture exactly as tall as the box, whichever way the box rounds
    const fit = box && box.width / box.height < MARK.width / MARK.height ? "cover" : "contain";

    return (
        <div
            aria-hidden="true"
            data-testid="dither-logo"
            className={`absolute inset-0 grid place-items-center ${className ?? ""}`.trim()}
        >
            <div
                ref={slot}
                className="relative h-[min(72%,var(--dither-logo))]"
                style={{ aspectRatio: `${MARK.width} / ${MARK.height}` }}
            >
                {dither && !failed ? (
                    <LogoBoundary fallback={<PlainMark />}>
                        <DitherVeil
                            source={dither.source}
                            fit={fit}
                            pattern="bayer"
                            pixelSize={2}
                            inkColor={dither.ink}
                            paperColor={dither.paper}
                            // Without it the revealed ground lands half a level above the ink
                            brightness={-0.02}
                            revealRadius={Math.max(40, Math.round((box?.height ?? 0) * REVEAL))}
                            softness={0.6}
                            linger={1}
                            wander
                            clickBurst={false}
                            intro={!reduced}
                            paused={reduced || !onScreen || tabHidden}
                            onError={() => setFailed(true)}
                        />
                    </LogoBoundary>
                ) : (
                    <PlainMark />
                )}
            </div>
        </div>
    );
}
