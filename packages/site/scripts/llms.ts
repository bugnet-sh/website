import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { llmsFiles } from "../lib/content/llms";

const publicDir = fileURLToPath(new URL("../public", import.meta.url));

// Every Markdown file in public/docs is written here, so a page taken out of the docs leaves none
// behind; the clips in public/docs/clips are not the build's, so they stay
const docsDir = join(publicDir, "docs");
await mkdir(docsDir, { recursive: true });
for (const name of await readdir(docsDir)) {
    if (name.endsWith(".md")) await rm(join(docsDir, name));
}
for (const [path, text] of llmsFiles()) {
    const target = join(publicDir, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, text);
}
