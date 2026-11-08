import { mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);

/**
 * The share image and the touch icon, drawn before `next build` so the export carries them. The
 * share image's text is already outlines in `assets/og.svg`, so no font is read or fetched.
 */
async function main(): Promise<void> {
    await mkdir(`${root}public`, { recursive: true });
    await sharp(await readFile(`${root}assets/og.svg`))
        .png()
        .toFile(`${root}public/og.png`);
    await sharp(await readFile(require.resolve("@bugnet/brand/icon.svg")))
        .resize(180, 180)
        .png()
        .toFile(`${root}app/apple-icon.png`);
}

await main();
