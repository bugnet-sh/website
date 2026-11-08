import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { llmsFiles } from "../lib/content/llms";

const publicDir = fileURLToPath(new URL("../public", import.meta.url));

// Every file in public/docs is written here, so a page taken out of the docs leaves none behind
await rm(join(publicDir, "docs"), { recursive: true, force: true });
for (const [path, text] of llmsFiles()) {
    const target = join(publicDir, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, text);
}
