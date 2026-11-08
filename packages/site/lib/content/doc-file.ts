import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Doc } from "./docs";
import { frontMatter, type FrontMatter } from "./front-matter";

/** `next build` and the index script both run in the package folder. */
export const docsDir = join(process.cwd(), "content/docs");

/**
 * A docs page's Markdown, read at build time. Its front matter title must be the one the docs
 * list gives, so the sidebar and the page never disagree.
 */
export function readDoc(doc: Doc, dir = docsDir): FrontMatter & { body: string } {
    const parsed = frontMatter(readFileSync(join(dir, doc.file), "utf8"), doc.file);
    if (parsed.title !== doc.title) {
        throw new Error(`${doc.file}: title "${parsed.title}" is not "${doc.title}"`);
    }
    return parsed;
}
