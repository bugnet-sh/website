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
        ignores: ["**/*.test.ts", "packages/*/src/testing/**"],
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
            "no-restricted-properties": [
                "error",
                ...["innerHTML", "outerHTML", "insertAdjacentHTML"].map((property) => ({
                    property,
                    message: textOnly,
                })),
                ...["write", "writeln"].map((property) => ({
                    object: "document",
                    property,
                    message: textOnly,
                })),
            ],
        },
    },
);
