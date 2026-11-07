/**
 * Builds the session page into a static bundle for the sessions role (session-page.md 7.2).
 *
 * The bundle is index.html, headers.txt (the response headers the role sends with every file)
 * and assets/ with hashed names: the script, the stylesheet, the four brand fonts and the icon.
 * index.html loads the script and the stylesheet by path and SHA-384, preloads the fonts, and
 * carries the logo inline.
 */
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const pageDir = join(here, "page");
const require = createRequire(import.meta.url);

export const headersFile = "headers.txt";

export interface BuildOptions {
    outdir: string;
}

export interface BuildResult {
    files: string[];
}

function integrity(bytes: Uint8Array): string {
    return `sha384-${createHash("sha384").update(bytes).digest("base64")}`;
}

// The same shape as esbuild's own [hash], so every asset name reads alike
function contentHash(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex").slice(0, 8).toUpperCase();
}

// A placeholder left in would ship a page that loads nothing or names a file that is not there
export function fillTemplate(html: string, values: Record<string, string>): string {
    let filled = html;
    for (const [placeholder, value] of Object.entries(values)) {
        if (!filled.includes(placeholder)) throw new Error(`index.html has no ${placeholder}`);
        filled = filled.split(placeholder).join(value);
    }
    if (filled.includes("__") || filled.includes("<!--")) {
        throw new Error("index.html has an unfilled placeholder");
    }
    return filled;
}

// The home link around the logo carries the name, so the drawing is hidden from readers
function inlineLogo(svg: string): string {
    const open = /<svg\b[^>]*>/.exec(svg);
    if (!open) throw new Error("the brand logo has no <svg> tag");
    const tag = open[0]
        .replace(/\s(role|aria-label|aria-hidden|focusable)="[^"]*"/g, "")
        .replace(/>$/, ' aria-hidden="true" focusable="false">');
    return (tag + svg.slice(open.index + open[0].length)).trim().replace(/>\s+</g, "><");
}

function only(files: esbuild.OutputFile[], ext: string): esbuild.OutputFile {
    const found = files.filter((f) => f.path.endsWith(ext));
    if (found.length !== 1) throw new Error(`esbuild wrote ${found.length} ${ext} files`);
    return found[0]!;
}

export async function buildPage(opts: BuildOptions): Promise<BuildResult> {
    const assets = join(opts.outdir, "assets");
    await rm(opts.outdir, { recursive: true, force: true });
    await mkdir(assets, { recursive: true });

    const shared = {
        bundle: true,
        minify: true,
        outdir: assets,
        entryNames: "page-[hash]",
        assetNames: "[name]-[hash]",
        write: false,
        logLevel: "silent",
    } satisfies esbuild.BuildOptions;
    const script = await esbuild.build({
        ...shared,
        entryPoints: [join(here, "main.ts")],
        format: "iife",
        platform: "browser",
        target: ["es2022"],
        legalComments: "eof",
    });
    const style = await esbuild.build({
        ...shared,
        entryPoints: [join(pageDir, "page.css")],
        loader: { ".woff2": "file" },
    });
    const outputs = [...script.outputFiles, ...style.outputFiles];
    const js = only(script.outputFiles, ".js");
    const css = only(style.outputFiles, ".css");
    const fonts = style.outputFiles.filter((f) => f.path.endsWith(".woff2"));
    if (outputs.length !== fonts.length + 2) throw new Error("esbuild wrote an unexpected file");
    for (const file of outputs) await writeFile(file.path, file.contents);

    const iconBytes = await readFile(require.resolve("@bugnet/brand/icon.svg"));
    const icon = join(assets, `icon-${contentHash(iconBytes)}.svg`);
    await writeFile(icon, iconBytes);
    await copyFile(join(pageDir, headersFile), join(opts.outdir, headersFile));

    const href = (path: string) => `/assets/${basename(path)}`;
    const preloads = fonts
        .map((f) => href(f.path))
        .sort()
        .map((h) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="${h}" />`);
    const logo = await readFile(require.resolve("@bugnet/brand/logo.svg"), "utf8");
    const html = fillTemplate(await readFile(join(pageDir, "index.html"), "utf8"), {
        __ICON__: href(icon),
        "<!--FONT_PRELOADS-->": preloads.join("\n        "),
        __PAGE_CSS_INTEGRITY__: integrity(css.contents),
        __PAGE_CSS__: href(css.path),
        __PAGE_JS_INTEGRITY__: integrity(js.contents),
        __PAGE_JS__: href(js.path),
        "<!--LOGO-->": inlineLogo(logo),
    });
    await writeFile(join(opts.outdir, "index.html"), html);

    const files = [...outputs.map((f) => f.path), icon].map((p) => relative(opts.outdir, p));
    return { files: ["index.html", headersFile, ...files].sort() };
}
