/** WCAG 2.x minimum contrast for normal text. */
const MINIMUM = 4.5;

const surfaces = ["--bg", "--surface", "--surface-hover"] as const;
const inks = ["--text", "--text-muted", "--accent", "--accent-2", "--bad", "--warn"] as const;

export const contrastPairs: readonly (readonly [string, string])[] = [
    ...inks.flatMap((fg) => surfaces.map((bg) => [fg, bg] as const)),
    ["--accent-ink", "--accent"],
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

export function checkContrast(
    tokens: Record<string, string>,
): { fg: string; bg: string; ratio: number }[] {
    return contrastPairs
        .map(([fg, bg]) => ({
            fg,
            bg,
            ratio: contrastRatio(tokens[fg] ?? "", tokens[bg] ?? ""),
        }))
        .filter((pair) => pair.ratio < MINIMUM);
}
