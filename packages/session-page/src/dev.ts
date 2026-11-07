/**
 * pnpm dev: builds the page into dist/ and serves it with the fake sessions route and the sample
 * scenarios, printing one link per scenario. A local tool only; it never ships.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPage } from "./build.ts";
import { makeScenarios } from "./testing/fixtures.ts";
import { startFakeRoute } from "./testing/route.ts";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const port = Number(process.env.PORT ?? 8448);

await buildPage({ outdir: dist });
const scenarios = makeScenarios(new Date());
const route = await startFakeRoute(dist, scenarios, { port });
for (const [name, s] of Object.entries(scenarios)) {
    process.stdout.write(`${name}  ${route.origin}/s/${s.id}#k=${s.key}\n`);
}
