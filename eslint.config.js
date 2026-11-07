import js from "@eslint/js";
import tseslint from "typescript-eslint";

const textOnly = "The session page sets text only, so nothing it shows is HTML.";

export default tseslint.config(
    {
        ignores: ["**/node_modules/**", "**/dist/**", "**/screens/**", ".superpowers/**"],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
        },
    },
    {
        files: ["packages/*/src/**/*.ts"],
        // dev.ts is a local tool that never ships, and it serves the page with the fake route
        ignores: ["**/*.test.ts", "packages/*/src/testing/**", "packages/session-page/src/dev.ts"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        { group: ["**/testing/*"], message: "The test harness is for tests only." },
                    ],
                },
            ],
        },
    },
    {
        files: ["packages/session-page/src/**/*.ts"],
        ignores: ["**/*.test.ts", "packages/session-page/src/testing/**"],
        rules: {
            "no-restricted-globals": ["error", { name: "DOMParser", message: textOnly }],
            "no-restricted-properties": [
                "error",
                ...["innerHTML", "outerHTML", "insertAdjacentHTML", "createContextualFragment"].map(
                    (property) => ({
                        property,
                        message: textOnly,
                    }),
                ),
                ...["write", "writeln"].map((property) => ({
                    object: "document",
                    property,
                    message: textOnly,
                })),
                ...["window", "globalThis", "self"].map((object) => ({
                    object,
                    property: "DOMParser",
                    message: textOnly,
                })),
            ],
        },
    },
);
