"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { mermaidConfig } from "../../lib/content/mermaid-config";

type Api = (typeof import("mermaid"))["default"];

let loading: Promise<Api> | undefined;

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
    svg.setAttribute("width", String(box.width));
    svg.setAttribute("height", String(box.height));
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
    const stage = useRef<HTMLDivElement>(null);
    const diagram = useRef<HTMLDivElement>(null);
    const [drawn, setDrawn] = useState(false);

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
                "relative mt-(--space-4) overflow-x-auto border-(length:--hairline) border-line p-(--space-5) first:mt-0",
                !drawn && "min-h-(--diagram)",
            )}
        >
            {!drawn && (
                <pre className="font-mono text-(length:--ui-size) leading-(--ui-line) whitespace-pre">
                    <code>{source}</code>
                </pre>
            )}
            <div ref={diagram} className="w-fit min-w-full [&>svg]:mx-auto" />
            <div ref={stage} aria-hidden className="invisible absolute inset-x-0 top-0" />
        </div>
    );
}
