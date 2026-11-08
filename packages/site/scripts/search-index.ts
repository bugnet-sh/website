import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { docs } from "../lib/content/docs";
import { buildSearchIndex } from "../lib/content/search-index";

const target = new URL("../public/search-index.json", import.meta.url);

await mkdir(fileURLToPath(new URL(".", target)), { recursive: true });
await writeFile(target, JSON.stringify(buildSearchIndex(docs)));
