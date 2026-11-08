import { defineConfig } from "vitest/config";

const site = ["packages/site/.next/**", "packages/site/out/**", "**/node_modules/**"];

export default defineConfig({
    test: {
        testTimeout: 20_000,
        projects: [
            {
                extends: true,
                test: {
                    name: "node",
                    include: [
                        "packages/*/src/**/*.test.ts",
                        "packages/*/test/**/*.test.ts",
                        "packages/site/**/*.test.ts",
                    ],
                    exclude: [...site, "packages/site/test/**"],
                    sequence: { groupOrder: 0 },
                },
            },
            {
                extends: true,
                // build.test deletes and rebuilds out/ while smoke.test serves it, so they run in turn
                test: {
                    name: "site-build",
                    include: ["packages/site/test/**/*.test.ts"],
                    exclude: site,
                    fileParallelism: false,
                    sequence: { groupOrder: 1 },
                },
            },
            {
                extends: true,
                // Next wants tsconfig's jsx left as "preserve", which the test transform cannot run
                oxc: { jsx: { runtime: "automatic" } },
                test: {
                    name: "dom",
                    include: ["packages/site/**/*.test.tsx"],
                    exclude: site,
                    environment: "jsdom",
                    sequence: { groupOrder: 0 },
                },
            },
        ],
    },
});
