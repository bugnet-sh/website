import js from "@eslint/js";
import tseslint from "typescript-eslint";

const textOnly = "The session page sets text only, so nothing it shows is HTML.";
const siteTextOnly = "The site renders text only, so nothing it shows is HTML.";

export default tseslint.config(
    {
        ignores: [
            "**/node_modules/**",
            "**/dist/**",
            "**/screens/**",
            ".superpowers/**",
            "packages/site/.next/**",
            "packages/site/out/**",
            "packages/site/next-env.d.ts",
        ],
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
    {
        files: ["packages/site/**/*.{ts,tsx}"],
        rules: {
            "no-restricted-syntax": [
                "error",
                ...[
                    "JSXAttribute[name.name='dangerouslySetInnerHTML']",
                    // The same prop handed to createElement or spread in from an object
                    "Property[key.name='dangerouslySetInnerHTML']",
                ].map((selector) => ({ selector, message: siteTextOnly })),
            ],
        },
    },
    {
        // The fake feed holds hostile samples that must never ship in a page
        files: ["packages/site/app/**/*.{ts,tsx}", "packages/site/components/**/*.{ts,tsx}"],
        ignores: ["**/*.test.{ts,tsx}"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            group: ["**/stats/testing/*", "**/stats/testing"],
                            message: "The fake stats feed is for tests and dev scripts only.",
                        },
                    ],
                },
            ],
        },
    },
    {
        // Vendored from React Bits as published, so it keeps its own @ts-nocheck
        files: [
            "packages/site/components/waves/sliced-waves.tsx",
            "packages/site/components/backgrounds/gradient-ascii.tsx",
            "packages/site/components/backgrounds/light-rays.tsx",
        ],
        rules: { "@typescript-eslint/ban-ts-comment": "off" },
    },
);
