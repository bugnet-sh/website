import { readFileSync } from "node:fs";
import { join } from "node:path";

const UPDATED = /^(Last updated: [^\n]+)\n+/;

/**
 * A legal file from `content/legal`, read at build time, with its opening "Last updated" line
 * apart so the page can set it in small type above the title.
 */
export function legalText(file: "terms.md" | "privacy.md"): { updated?: string; body: string } {
    // `next build` runs in the package folder
    const source = readFileSync(join(process.cwd(), "content/legal", file), "utf8");
    const match = UPDATED.exec(source);
    return match ? { updated: match[1], body: source.slice(match[0].length) } : { body: source };
}
