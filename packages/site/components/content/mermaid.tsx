"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { mermaidConfig } from "../../lib/content/mermaid-config";

type Api = (typeof import("mermaid"))["default"];

let loading: Promise<Api> | undefined;

const SEQUENCE_TAIL = 20;

/** Mermaid, fetched once for the first diagram near the screen and set up in the site's tokens. */
function load(): Promise<Api> {
    loading ??= Promise.all([import("mermaid"), document.fonts.ready]).then(([module]) => {
        const styles = getComputedStyle(document.documentElement);
        module.default.initialize(mermaidConfig((name) => styles.getPropertyValue(name).trim()));
        return module.default;
    });
    return loading;
}

/** The SVG string as a node, parsed rather than set as HTML, at its natural size. */
function toSvg(markup: string): SVGSVGElement | null {
    const svg = new DOMParser().parseFromString(markup, "text/html").querySelector("svg");
    const box = svg?.viewBox.baseVal;
    if (!svg || !box?.width) return null;
    // A sequence diagram's box ends on its last message, which cuts that arrow in half; its
    // lifelines run on, so half an actor box more shows the arrow and ends them past it
    const height = box.height + (svg.querySelector(".actor-line") ? SEQUENCE_TAIL : 0);
    svg.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${height}`);
    svg.setAttribute("width", String(box.width));
    svg.setAttribute("height", String(height));
    svg.style.removeProperty("max-width");
    return svg;
}

/**
 * A Mermaid diagram, drawn in the browser once it nears the screen. Until then, and without
 * JavaScript, its box shows the source as plain code; a source Mermaid cannot read stays as code.
 */
export function Mermaid({ source }: { source: string }) {
    const id = `mermaid-${useId().replace(/[^\w-]/g, "")}`;
    const box = useRef<HTMLDivElement>(null);
    const scroller = useRef<HTMLDivElement>(null);
    const stage = useRef<HTMLDivElement>(null);
    const diagram = useRef<HTMLDivElement>(null);
    const [drawn, setDrawn] = useState(false);
    const [more, setMore] = useState(false);

    // Whether the diagram runs on past the right edge, so a phone shows that it scrolls
    const measure = useCallback(() => {
        const el = scroller.current;
        if (el) setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    }, []);

    useEffect(() => {
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [drawn, measure]);

    useEffect(() => {
        const target = box.current;
        if (!target) return;
        let live = true;
        const draw = async () => {
            const mermaid = await load();
            // Drawn inside the box, so Mermaid measures labels under the article's own type
            const { svg } = await mermaid.render(id, source, stage.current ?? undefined);
            const node = toSvg(svg);
            if (!live || !node || !diagram.current) return;
            diagram.current.replaceChildren(node);
            setDrawn(true);
        };
        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries.some((entry) => entry.isIntersecting)) return;
                observer.disconnect();
                draw().catch(() => undefined);
            },
            { rootMargin: "50% 0px" },
        );
        observer.observe(target);
        return () => {
            live = false;
            observer.disconnect();
        };
    }, [id, source]);

    return (
        <div
            ref={box}
            className={cx(
                "relative mt-(--prose-gap) border-(length:--hairline) border-line first:mt-0",
                !drawn && "min-h-(--diagram)",
            )}
        >
            {/* Wider than the box, it scrolls inside the hairline and fades at the right edge
                until it reaches its end */}
            <div
                ref={scroller}
                onScroll={measure}
                data-more={more || undefined}
                className="overflow-x-auto p-(--space-5) data-more:[mask-image:linear-gradient(to_left,transparent,#000_var(--space-7))]"
            >
                {!drawn && (
                    <pre className="font-mono text-(length:--ui-size) leading-(--ui-line) whitespace-pre">
                        <code>{source}</code>
                    </pre>
                )}
                <div ref={diagram} className="w-fit min-w-full [&>svg]:mx-auto" />
            </div>
            <div ref={stage} aria-hidden className="invisible absolute inset-x-0 top-0" />
        </div>
    );
}
