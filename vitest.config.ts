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
                    exclude: site,
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
                },
            },
        ],
    },
});
