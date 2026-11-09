import { cx } from "../../lib/cx";
import { highlight, type Token, type TokenKind } from "../../lib/content/highlight";
import { CopyButton } from "../stats/copy-button";
import { ScrollX } from "./scroll-x";

const colours: Record<Exclude<TokenKind, "plain">, string> = {
    command: "text-text",
    flag: "text-accent-3",
    key: "text-accent-3",
    string: "text-accent",
    literal: "text-warn",
    comment: "text-text-muted",
    punct: "text-text-muted",
};

/** A token's colour; the command "claude" wears Claude Code's own orange. */
function colourOf(token: Token): string {
    if (token.kind === "command" && token.text === "claude") return "text-claude";
    return colours[token.kind as Exclude<TokenKind, "plain">];
}

function paint(tokens: Token[]) {
    return tokens.map((token, i) =>
        token.kind === "plain" ? (
            token.text
        ) : (
            <span key={i} className={colourOf(token)}>
                {token.text}
            </span>
        ),
    );
}

/** The tokens line by line, each line keeping its line break, so the block's text stays whole. */
function byLine(tokens: Token[]): Token[][] {
    const lines: Token[][] = [[]];
    for (const token of tokens) {
        token.text.split("\n").forEach((text, i) => {
            if (i > 0) {
                lines.at(-1)?.push({ kind: "plain", text: "\n" });
                lines.push([]);
            }
            if (text) lines.at(-1)?.push({ kind: token.kind, text });
        });
    }
    return lines;
}

/**
 * A line's words, each its tokens, between the runs of spaces where it may wrap. A word wraps
 * inside itself only when it is wider than the block, so a flag never splits at its hyphen.
 */
function byWord(line: Token[]): (Token[] | string)[] {
    const parts: (Token[] | string)[] = [];
    let word: Token[] | undefined;
    for (const token of line) {
        for (const text of token.text.split(/(\s+)/)) {
            if (!text) continue;
            if (/^\s/.test(text)) {
                word = undefined;
                parts.push(text);
            } else {
                if (!word) parts.push((word = []));
                word.push({ kind: token.kind, text });
            }
        }
    }
    return parts;
}

/**
 * How a line wider than the block shows: it scrolls; it scrolls and the block's right edge fades
 * while more is hidden; or it wraps, its later lines set in, as a shell command can.
 */
export type Long = "scroll" | "fade" | "wrap";

/**
 * A fenced block: one line per line, with Copy beside it. A shell or JSON block is coloured by
 * token; any other language shows as plain text. In a row beside a button, `inRow` makes a
 * one-line block that button's height; phones stack the row, and the block wraps there instead of
 * scrolling. `className` sets the space above it, 16 px by default.
 */
export function CodeBlock({
    code,
    lang,
    inRow = false,
    long = "scroll",
    className = "mt-(--space-4) first:mt-0",
}: {
    code: string;
    lang?: string;
    inRow?: boolean;
    long?: Long;
    className?: string;
}) {
    const tokens = highlight(code, lang);
    const mode = inRow ? "row" : long;
    const pre = (
        <pre
            className={cx(
                "pl-(--space-4) font-mono text-(length:--ui-size) leading-(--ui-line)",
                {
                    row: "min-w-0 flex-1 overflow-x-auto py-[calc((var(--button)-var(--ui-line))/2-var(--hairline))] whitespace-pre phone:wrap-anywhere phone:whitespace-pre-wrap phone:py-(--space-3)",
                    scroll: "min-w-0 flex-1 overflow-x-auto py-(--space-3) whitespace-pre",
                    // As wide as its longest line, so the fade hears the width change as fonts load
                    fade: "w-max min-w-full py-(--space-3) whitespace-pre",
                    wrap: "min-w-0 flex-1 py-(--space-3) wrap-break-word whitespace-pre-wrap",
                }[mode],
            )}
        >
            <code>
                {mode === "wrap"
                    ? byLine(tokens ?? [{ kind: "plain", text: code }]).map((line, i) => (
                          <span key={i} className="block pl-[2ch] -indent-[2ch]">
                              {byWord(line).map((part, j) =>
                                  typeof part === "string" ? (
                                      part
                                  ) : (
                                      <span
                                          key={j}
                                          className="inline-block max-w-full indent-0 wrap-anywhere"
                                      >
                                          {paint(part)}
                                      </span>
                                  ),
                              )}
                          </span>
                      ))
                    : tokens
                      ? paint(tokens)
                      : code}
            </code>
        </pre>
    );
    return (
        <div
            className={cx(
                "flex items-start border-(length:--hairline) border-line bg-surface",
                className,
            )}
        >
            {mode === "fade" ? <ScrollX className="min-w-0 flex-1">{pre}</ScrollX> : pre}
            {/* Centred on the first line: 8 px + half a 28 px button = 12 px + half a 20 px line,
                or in a row, 2 px + 14 px = 6 px + 10 px */}
            <div
                className={cx(
                    "shrink-0",
                    inRow
                        ? "py-[calc((var(--button)-var(--segment))/2-var(--hairline))] pr-[calc((var(--button)-var(--segment))/2-var(--hairline))] pl-(--space-2) phone:p-(--space-2)"
                        : "p-(--space-2)",
                )}
            >
                <CopyButton text={code} label="Copy code" form="icon" />
            </div>
        </div>
    );
}
