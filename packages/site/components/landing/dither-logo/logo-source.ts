/** The mark from `@bugnet/brand/logo.svg`, shape for shape, for both the canvas and the SVG. */
export const LOGO = {
    viewBox: [320, 264, 608, 693] as const,
    strokeWidth: 31,
    strokes: ["M 556 415 C 546 364 514 330 460 309", "M 694 415 C 704 364 736 330 790 309"],
    circles: [
        [440, 307, 43],
        [810, 307, 43],
    ] as const,
    head: "M 446 563 L 446 534 C 446 455 524 393 624 393 C 724 393 802 455 802 534 L 802 563 L 624 640 Z M 573 499 A 31 31 0 1 0 511 499 A 31 31 0 1 0 573 499 Z M 737 499 A 31 31 0 1 0 675 499 A 31 31 0 1 0 737 499 Z",
    wings: [
        "M 430 501 L 333 547 Q 320 553 320 566 L 320 641 Q 320 653 334 659 L 375 675 L 375 822 Q 375 840 393 849 L 591 946 Q 611 957 611 935 L 611 691 Q 611 677 599 671 L 363 562 L 428 533 Q 426 518 430 501 Z",
        "M 818 501 L 915 547 Q 928 553 928 566 L 928 641 Q 928 653 914 659 L 873 675 L 873 822 Q 873 840 855 849 L 657 946 Q 637 957 637 935 L 637 691 Q 637 677 649 671 L 885 562 L 820 533 Q 822 518 818 501 Z",
    ],
};

/** Source pixels per logo unit: above the largest drawn size at the capped pixel ratio. */
const SCALE = 1.25;
/** The solid outline, in logo units, so the silhouette stays sharp under the dither. */
const OUTLINE = 4.5;

/**
 * Each inside pixel's distance to the nearest outside pixel (a two-pass chamfer). Pixels past
 * the border count as outside, since the wings touch the viewBox's edges.
 */
export function insideDistance(inside: Uint8Array, width: number, height: number) {
    const d = new Float32Array(width * height);
    for (let i = 0; i < d.length; i++) d[i] = inside[i] ? Infinity : 0;
    const at = (x: number, y: number) =>
        x < 0 || y < 0 || x >= width || y >= height ? 0 : d[y * width + x]!;
    const relax = (x: number, y: number, dx: number, dy: number) => {
        const i = y * width + x;
        if (d[i] === 0) return;
        d[i] = Math.min(
            d[i]!,
            at(x - dx, y) + 1,
            at(x, y - dy) + 1,
            at(x - dx, y - dy) + Math.SQRT2,
            at(x + dx, y - dy) + Math.SQRT2,
        );
    };
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) relax(x, y, 1, 1);
    for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) relax(x, y, -1, -1);
    return d;
}

function hex(color: string): [number, number, number] {
    const n = parseInt(color.replace("#", "").slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Draws the mark in the context's fill colour, one logo unit to `scale` pixels. */
export function drawLogo(context: CanvasRenderingContext2D, scale: number) {
    const [x, y] = LOGO.viewBox;
    context.setTransform(scale, 0, 0, scale, -x * scale, -y * scale);
    context.strokeStyle = context.fillStyle;
    context.lineWidth = LOGO.strokeWidth;
    context.lineCap = "round";
    for (const d of LOGO.strokes) context.stroke(new Path2D(d));
    for (const [cx, cy, r] of LOGO.circles) {
        context.beginPath();
        context.arc(cx, cy, r, 0, Math.PI * 2);
        context.fill();
    }
    context.fill(new Path2D(LOGO.head), "evenodd");
    for (const d of LOGO.wings) context.fill(new Path2D(d));
    context.setTransform(1, 0, 0, 1, 0, 0);
}

/**
 * The picture the dither veil draws: the mark on black, its brightness setting how dense the
 * dots fall (a solid outline, a glow inside it that fades toward the middle of each part) and
 * its hue the dots' colour, from `top` down into `bottom`.
 */
export function logoSource(top: string, bottom: string): HTMLCanvasElement {
    const [, , w, h] = LOGO.viewBox;
    const width = Math.round(w * SCALE);
    const height = Math.round(h * SCALE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("No 2D canvas");
    context.fillStyle = "#ffffff";
    drawLogo(context, SCALE);

    const image = context.getImageData(0, 0, width, height);
    const px = image.data;
    const inside = new Uint8Array(width * height);
    for (let i = 0; i < inside.length; i++) inside[i] = px[i * 4 + 3]! >= 128 ? 1 : 0;
    const distance = insideDistance(inside, width, height);

    const from = hex(top);
    const to = hex(bottom);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            const coverage = px[i * 4 + 3]! / 255;
            const units = distance[i]! / SCALE;
            const glow = Math.exp(-Math.max(0, units - OUTLINE) / 16);
            const light = 0.1 * (x / width - y / height);
            const tone = units < OUTLINE ? 1 : Math.min(1, 0.4 + 0.5 * glow + light);
            const u = Math.min(1, Math.max(0, (y / height - 0.35) / 0.6 + (0.5 - x / width) * 0.3));
            const k = u * u * (3 - 2 * u);
            const r = from[0] + (to[0] - from[0]) * k;
            const g = from[1] + (to[1] - from[1]) * k;
            const b = from[2] + (to[2] - from[2]) * k;
            // Full value for the hue, so the brightness carries only the tone
            const gain = (255 * tone * coverage) / Math.max(r, g, b, 1);
            px[i * 4] = r * gain;
            px[i * 4 + 1] = g * gain;
            px[i * 4 + 2] = b * gain;
            px[i * 4 + 3] = 255;
        }
    }
    context.putImageData(image, 0, 0);
    return canvas;
}
