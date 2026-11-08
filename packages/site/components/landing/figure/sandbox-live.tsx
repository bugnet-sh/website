"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { partsOf, type Rig } from "./parts";
import { PERIOD, poseAt, STILL } from "./tour";

const LONGEST_FRAME = 1 / 30;

/**
 * Plays the cabinet's tour on the drawing the server rendered, by writing attributes on its
 * `data-part` elements. It runs only while on screen, and holds the server's pose under reduced
 * motion.
 */
export function SandboxLive({
    rig,
    className,
    style,
    children,
}: {
    rig: Rig;
    className: string;
    style: CSSProperties;
    children: ReactNode;
}) {
    const root = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const node = root.current;
        if (!node) return;
        const parts = new Map<string, Element[]>();
        for (const element of node.querySelectorAll("[data-part]")) {
            const name = element.getAttribute("data-part") ?? "";
            parts.set(name, [...(parts.get(name) ?? []), element]);
        }
        const still = window.matchMedia("(prefers-reduced-motion: reduce)");
        let clock = STILL;
        let frame = 0;
        let last = 0;
        let visible = false;

        const apply = (time: number) => {
            const pose = poseAt(time);
            for (const [name, attributes] of Object.entries(partsOf(pose, rig))) {
                for (const element of parts.get(name) ?? []) {
                    for (const [key, value] of Object.entries(attributes)) {
                        if (value === null) element.removeAttribute(key);
                        else if (element.getAttribute(key) !== value) {
                            element.setAttribute(key, value);
                        }
                    }
                }
            }
            pose.lines.forEach((text, index) => {
                const line = parts.get(`line-${index}`)?.[0];
                const cursor = parts.get(`cursor-${index}`)?.[0];
                if (line && line.textContent !== text) line.textContent = text;
                cursor?.toggleAttribute("data-on", pose.cursor === index);
            });
        };
        const tick = (now: number) => {
            const dt = last ? Math.min((now - last) / 1000, LONGEST_FRAME) : 1 / 60;
            last = now;
            clock = (clock + dt) % PERIOD;
            apply(clock);
            frame = requestAnimationFrame(tick);
        };
        const stop = () => {
            cancelAnimationFrame(frame);
            frame = 0;
        };
        const run = () => {
            if (frame || !visible || still.matches) return;
            last = 0;
            frame = requestAnimationFrame(tick);
        };
        const observer = new IntersectionObserver(
            (entries) => {
                visible = Boolean(entries.at(-1)?.isIntersecting);
                if (visible) run();
                else stop();
            },
            { rootMargin: "120px 0px" },
        );
        const calm = () => {
            if (!still.matches) return run();
            stop();
            clock = STILL;
            apply(clock);
        };
        observer.observe(node);
        still.addEventListener("change", calm);
        return () => {
            stop();
            observer.disconnect();
            still.removeEventListener("change", calm);
        };
    }, [rig]);

    return (
        <div ref={root} className={className} style={style}>
            {children}
        </div>
    );
}
