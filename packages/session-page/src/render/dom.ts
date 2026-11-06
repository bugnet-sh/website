export interface ElOpts {
    class?: string;
    text?: string;
    attrs?: Record<string, string>;
}

const SVG_NS = "http://www.w3.org/2000/svg";

// Inline styles and handlers would need CSP relaxations and are how markup injection becomes
// script, so they are refused rather than escaped.
function setAttrs(node: Element, attrs: Record<string, string> | undefined): void {
    if (attrs === undefined) return;
    for (const [name, value] of Object.entries(attrs)) {
        const lower = name.toLowerCase();
        if (lower === "style" || lower.startsWith("on")) {
            throw new Error(`attribute not allowed: ${name}`);
        }
        node.setAttribute(name, value);
    }
}

export function el<K extends keyof HTMLElementTagNameMap>(
    doc: Document,
    tag: K,
    opts: ElOpts = {},
    children: Node[] = [],
): HTMLElementTagNameMap[K] {
    const node = doc.createElement(tag);
    if (opts.class !== undefined) node.className = opts.class;
    if (opts.text !== undefined) node.textContent = opts.text;
    setAttrs(node, opts.attrs);
    for (const child of children) node.appendChild(child);
    return node;
}

export function svgEl<K extends keyof SVGElementTagNameMap>(
    doc: Document,
    tag: K,
    attrs: Record<string, string> = {},
    children: Node[] = [],
): SVGElementTagNameMap[K] {
    const node = doc.createElementNS(SVG_NS, tag);
    setAttrs(node, attrs);
    for (const child of children) node.appendChild(child);
    return node;
}
