import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPage } from "./build.ts";

const outdir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const result = await buildPage({ outdir });
process.stdout.write(`built ${result.files.length} files into ${outdir}\n`);
