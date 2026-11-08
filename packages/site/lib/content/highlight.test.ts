import { describe, expect, it } from "vitest";
import { highlight, type Token } from "./highlight";

const kinds = (tokens: Token[] | null) =>
    (tokens ?? []).filter((t) => t.kind !== "plain").map((t) => [t.kind, t.text]);

describe("shell", () => {
    it("marks the command, its flags and a URL", () => {
        expect(
            kinds(
                highlight("claude mcp add --transport http bugnet https://mcp.bugnet.sh/mcp", "sh"),
            ),
        ).toEqual([
            ["command", "claude"],
            ["flag", "--transport"],
            ["string", "https://mcp.bugnet.sh/mcp"],
        ]);
    });

    it("takes a comment to the line's end and starts a command on each line", () => {
        const code = "claude plugin install bugnet@bugnet   # pays by link\npay setup";
        expect(kinds(highlight(code, "sh"))).toEqual([
            ["command", "claude"],
            ["comment", "# pays by link"],
            ["command", "pay"],
        ]);
    });

    it("keeps a quoted argument whole and starts a command after an operator", () => {
        const code = `code --add-mcp '{"name":"bugnet"}' && BUGNET_HINTS=off npx -y @bugnet/mcp`;
        expect(kinds(highlight(code, "sh"))).toEqual([
            ["command", "code"],
            ["flag", "--add-mcp"],
            ["string", `'{"name":"bugnet"}'`],
            ["command", "npx"],
            ["flag", "-y"],
        ]);
    });

    it("leaves a # inside a word alone and continues a command over a backslash", () => {
        expect(kinds(highlight("echo a#b \\\n  --flag", "bash"))).toEqual([
            ["command", "echo"],
            ["flag", "--flag"],
        ]);
    });
});

describe("json", () => {
    it("tells keys from string values, and marks numbers, literals and punctuation", () => {
        const tokens = highlight('{ "url": "https://x", "n": -1.5e3, "ok": true }', "json");
        expect(kinds(tokens)).toEqual([
            ["punct", "{"],
            ["key", '"url"'],
            ["punct", ":"],
            ["string", '"https://x"'],
            ["punct", ","],
            ["key", '"n"'],
            ["punct", ":"],
            ["literal", "-1.5e3"],
            ["punct", ","],
            ["key", '"ok"'],
            ["punct", ":"],
            ["literal", "true"],
            ["punct", "}"],
        ]);
    });

    it("reads an escaped quote inside a string and merges neighbouring punctuation", () => {
        expect(kinds(highlight('["a\\"b"]', "json"))).toEqual([
            ["punct", "["],
            ["string", '"a\\"b"'],
            ["punct", "]"],
        ]);
        expect(kinds(highlight("[{}]", "json"))).toEqual([["punct", "[{}]"]]);
    });
});

it("returns every character, in order, for both languages", () => {
    for (const [code, lang] of [
        ["claude mcp add\r\n  x 'open", "sh"],
        ['{"a": [1, nul, "b\n', "json"],
    ] as const) {
        expect(
            highlight(code, lang)
                ?.map((t) => t.text)
                .join(""),
        ).toBe(code);
    }
});

it("colours nothing in a language it does not know, or without one", () => {
    expect(highlight("x = 1", "toml")).toBeNull();
    expect(highlight("x = 1", undefined)).toBeNull();
});
