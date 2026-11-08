/** WCAG 2.x minimum contrast for normal text. */
const MINIMUM = 4.5;

const surfaces = ["--bg", "--surface", "--surface-hover"] as const;
const inks = [
    "--text",
    "--text-muted",
    "--accent",
    "--accent-2",
    "--accent-3",
    "--bad",
    "--warn",
] as const;
const fills = ["--chart-profit", "--chart-loss"] as const;

export const contrastPairs: readonly (readonly [string, string])[] = [
    ...[...inks, ...fills].flatMap((fg) => surfaces.map((bg) => [fg, bg] as const)),
    ["--accent-ink", "--accent"],
    ["--accent-3-ink", "--accent-3"],
    ["--text", "--code-inline"],
    ["--claude", "--surface"],
];

function channel(value: number): number {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
    const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
    if (!match?.[1]) throw new Error(`not a #RRGGBB colour: ${hex}`);
    const n = parseInt(match[1], 16);
    return (
        0.2126 * channel((n >> 16) & 255) +
        0.7152 * channel((n >> 8) & 255) +
        0.0722 * channel(n & 255)
    );
}

export function contrastRatio(a: string, b: string): number {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return (light + 0.05) / (dark + 0.05);
}

export function readTokens(css: string): Record<string, string> {
    const tokens: Record<string, string> = {};
    for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
        // Prettier lowercases hex in the stylesheet; the documented palette is upper case.
        const value = (match[2] as string).trim();
        tokens[match[1] as string] = /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : value;
    }
    return tokens;
}

const HEX = /^#[0-9a-f]{6}$/i;
const ALIAS = /^var\((--[a-z0-9-]+)\)$/i;
const WASH = /^color-mix\(in srgb,\s*var\((--[a-z0-9-]+)\)\s+(\d+(?:\.\d+)?)%,\s*transparent\)$/i;

/**
 * The opaque #RRGGBB a token paints over the token `under`. A color-mix wash with transparent is
 * the colour at that alpha, which the browser blends with what lies beneath in sRGB.
 */
export function resolveColour(tokens: Record<string, string>, name: string, under: string): string {
    const value = tokens[name];
    if (value === undefined) throw new Error(`no colour token ${name}`);
    if (HEX.test(value)) return value.toUpperCase();
    const alias = ALIAS.exec(value);
    if (alias?.[1]) return resolveColour(tokens, alias[1], under);
    const wash = WASH.exec(value);
    if (wash?.[1] && wash[2]) {
        const alpha = Number(wash[2]) / 100;
        const top = parseInt(resolveColour(tokens, wash[1], under).slice(1), 16);
        const bottom = parseInt(resolveColour(tokens, under, under).slice(1), 16);
        let hex = "#";
        for (const shift of [16, 8, 0]) {
            const blended =
                ((top >> shift) & 255) * alpha + ((bottom >> shift) & 255) * (1 - alpha);
            hex += Math.round(blended).toString(16).padStart(2, "0");
        }
        return hex.toUpperCase();
    }
    throw new Error(`cannot measure ${name}: ${value}`);
}

export function checkContrast(
    tokens: Record<string, string>,
): { fg: string; bg: string; ratio: number }[] {
    return contrastPairs
        .map(([fg, bg]) => ({
            fg,
            bg,
            ratio: contrastRatio(resolveColour(tokens, fg, bg), resolveColour(tokens, bg, bg)),
        }))
        .filter((pair) => pair.ratio < MINIMUM);
}
