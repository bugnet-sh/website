import type { MermaidConfig } from "mermaid";

/**
 * Mermaid's settings in the site's tokens, read from the page so the diagrams follow the brand
 * file. Everything stays in white and greys: nodes on the surface with a hairline, text in white,
 * lines, arrows and edge labels muted.
 */
export function mermaidConfig(token: (name: string) => string): MermaidConfig {
    const bg = token("--bg");
    const surface = token("--surface");
    const raised = token("--surface-hover");
    const line = token("--line");
    const text = token("--text");
    const muted = token("--text-muted");
    const ui = token("--font-ui");
    const mono = token("--font-mono");
    const size = parseFloat(token("--ui-size"));

    return {
        startOnLoad: false,
        securityLevel: "strict",
        suppressErrorRendering: true,
        theme: "base",
        look: "classic",
        // ELK is a 1.6 MB download of its own; dagre lays out the docs' small graphs as well
        layout: "dagre",
        darkMode: true,
        fontFamily: ui,
        fontSize: size,
        themeVariables: {
            darkMode: true,
            background: bg,
            fontFamily: ui,
            fontSize: `${size}px`,
            radius: 0,
            strokeWidth: 1,
            useGradient: false,
            dropShadow: "none",

            primaryColor: surface,
            primaryBorderColor: line,
            primaryTextColor: text,
            secondaryColor: surface,
            secondaryBorderColor: line,
            secondaryTextColor: muted,
            tertiaryColor: surface,
            tertiaryBorderColor: line,
            tertiaryTextColor: muted,
            mainBkg: surface,
            nodeBkg: surface,
            nodeBorder: line,
            nodeTextColor: text,
            textColor: text,
            titleColor: text,
            lineColor: muted,
            defaultLinkColor: muted,
            arrowheadColor: muted,
            edgeLabelBackground: bg,
            clusterBkg: bg,
            clusterBorder: line,

            actorBkg: surface,
            actorBorder: line,
            actorTextColor: text,
            actorLineColor: line,
            signalColor: muted,
            signalTextColor: text,
            labelBoxBkgColor: surface,
            labelBoxBorderColor: line,
            labelTextColor: text,
            loopTextColor: muted,
            noteBkgColor: raised,
            noteBorderColor: line,
            noteTextColor: text,
            activationBkgColor: raised,
            activationBorderColor: line,
            sequenceNumberColor: bg,
        },
        // Square corners everywhere, hairline edges, and code in labels set in the mono face
        themeCSS: [
            "rect{rx:0;ry:0}",
            ".flowchart-link{stroke-width:1px}",
            `.edgeLabel,.edgeLabel p{color:${muted}}`,
            `code{font-family:${mono}}`,
        ].join(""),
        // The box pads the diagram, so Mermaid's own margins go
        flowchart: {
            // Steps bend into slanted stubs where an edge ends going down, so top-down charts break
            curve: "basis",
            diagramPadding: 0,
            nodeSpacing: 32,
            rankSpacing: 32,
            padding: 12,
            minNodeWidth: 0,
        },
        sequence: {
            mirrorActors: false,
            diagramMarginX: 0,
            diagramMarginY: 0,
            // Fits four participants with short labels in the docs column
            width: 112,
            height: 40,
            actorMargin: 20,
            actorFontFamily: ui,
            actorFontSize: size,
            messageFontFamily: ui,
            messageFontSize: size,
            noteFontFamily: ui,
            noteFontSize: size,
        },
    };
}
