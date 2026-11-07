import { readFileSync } from "node:fs";
import { contrastPairs, contrastRatio, readTokens, resolveColour } from "./contrast.ts";

const tokens = readTokens(readFileSync(new URL("../tokens.css", import.meta.url), "utf8"));

let failed = false;
for (const [fg, bg] of contrastPairs) {
    const ratio = contrastRatio(resolveColour(tokens, fg, bg), resolveColour(tokens, bg, bg));
    const pass = ratio >= 4.5;
    failed ||= !pass;
    console.log(`${pass ? "PASS" : "FAIL"} ${ratio.toFixed(2)} ${fg} on ${bg}`);
}
process.exit(failed ? 1 : 0);
