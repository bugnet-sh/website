/**
 * What a token is, which the code block colours: commands in text, flags and keys in violet,
 * strings and URLs in green, numbers and literals in amber, comments and punctuation muted.
 */
export type TokenKind =
    "plain" | "command" | "flag" | "string" | "comment" | "key" | "literal" | "punct";

export type Token = { kind: TokenKind; text: string };

// Spaces and tabs, not the line break, which starts the next command
const SPACE = /[^\S\n]+/y;
// A word ends at a space, a line break, a quote or a shell operator
const WORD = /[^\s"'|;&]+/y;
const OPERATOR = /&&|\|\||[|;&]/y;
const ASSIGNMENT = /^[A-Za-z_]\w*=/;
const URL_START = /^https?:\/\//;

function quoted(code: string, at: number): number {
    const quote = code[at];
    let i = at + 1;
    while (i < code.length && code[i] !== quote && code[i] !== "\n") {
        // Only double quotes escape in the shell, and JSON strings are double-quoted
        if (code[i] === "\\" && quote === '"') i++;
        i++;
    }
    return Math.min(i + 1, code.length);
}

function match(pattern: RegExp, code: string, at: number): string | null {
    pattern.lastIndex = at;
    return pattern.exec(code)?.[0] ?? null;
}

function shell(code: string): Token[] {
    const tokens: Token[] = [];
    // The next word names a command: at a line's start and after an operator
    let command = true;
    let i = 0;
    while (i < code.length) {
        const c = code[i] as string;
        const space = match(SPACE, code, i);
        if (space) {
            tokens.push({ kind: "plain", text: space });
            i += space.length;
            continue;
        }
        if (c === "\n") {
            tokens.push({ kind: "plain", text: c });
            command = true;
            i++;
            continue;
        }
        if (c === "\\" && code[i + 1] === "\n") {
            // A continued line goes on with the same command's arguments
            tokens.push({ kind: "plain", text: "\\\n" });
            i += 2;
            continue;
        }
        if (c === "#" && (i === 0 || /\s/.test(code[i - 1] as string))) {
            const end = code.indexOf("\n", i);
            const stop = end === -1 ? code.length : end;
            tokens.push({ kind: "comment", text: code.slice(i, stop) });
            i = stop;
            continue;
        }
        if (c === '"' || c === "'") {
            const end = quoted(code, i);
            tokens.push({ kind: "string", text: code.slice(i, end) });
            command = false;
            i = end;
            continue;
        }
        const operator = match(OPERATOR, code, i);
        if (operator) {
            tokens.push({ kind: "plain", text: operator });
            command = true;
            i += operator.length;
            continue;
        }
        const word = match(WORD, code, i) as string;
        i += word.length;
        // `NAME=value claude …` sets a variable for the command that follows it
        if (command && ASSIGNMENT.test(word)) {
            tokens.push({ kind: "plain", text: word });
            continue;
        }
        let kind: TokenKind = "plain";
        if (URL_START.test(word)) kind = "string";
        else if (command) kind = "command";
        else if (word.startsWith("-")) kind = "flag";
        tokens.push({ kind, text: word });
        command = false;
    }
    return tokens;
}

const JSON_SPACE = /\s+/y;
const NUMBER = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const LITERAL = /(?:true|false|null)\b/y;
const BARE = /[^\s{}[\],:"]+/y;

function json(code: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    while (i < code.length) {
        const c = code[i] as string;
        const space = match(JSON_SPACE, code, i);
        if (space) {
            tokens.push({ kind: "plain", text: space });
            i += space.length;
            continue;
        }
        if ("{}[],:".includes(c)) {
            tokens.push({ kind: "punct", text: c });
            i++;
            continue;
        }
        if (c === '"') {
            const end = quoted(code, i);
            // A string followed by a colon is a key
            const key = /^\s*:/.test(code.slice(end));
            tokens.push({ kind: key ? "key" : "string", text: code.slice(i, end) });
            i = end;
            continue;
        }
        const literal = match(NUMBER, code, i) ?? match(LITERAL, code, i);
        if (literal) {
            tokens.push({ kind: "literal", text: literal });
            i += literal.length;
            continue;
        }
        const bare = match(BARE, code, i) as string;
        tokens.push({ kind: "plain", text: bare });
        i += bare.length;
    }
    return tokens;
}

const languages: Record<string, (code: string) => Token[]> = {
    sh: shell,
    bash: shell,
    shell,
    json,
};

/** Neighbouring tokens of one kind become one, so the page renders as few spans as it can. */
function merge(tokens: Token[]): Token[] {
    const merged: Token[] = [];
    for (const token of tokens) {
        const last = merged.at(-1);
        if (last && last.kind === token.kind) last.text += token.text;
        else merged.push({ ...token });
    }
    return merged;
}

/** The tokens of a fenced block, or null for a language the site does not colour. */
export function highlight(code: string, lang: string | undefined): Token[] | null {
    const tokenize = lang === undefined ? undefined : languages[lang.toLowerCase()];
    return tokenize ? merge(tokenize(code)) : null;
}
