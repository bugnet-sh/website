import { cx } from "../../lib/cx";
import { highlight, type Token, type TokenKind } from "../../lib/content/highlight";
import { CopyButton } from "../stats/copy-button";

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

/**
 * A fenced block: one line per line, scrolled sideways when long, with Copy beside it. A shell or
 * JSON block is coloured by token; any other language shows as plain text. In a row beside a
 * button, `inRow` makes a one-line block that button's height; phones stack the row, and the
 * block wraps there instead of scrolling. `className` sets the space above it, 16 px by default.
 */
export function CodeBlock({
    code,
    lang,
    inRow = false,
    className = "mt-(--space-4) first:mt-0",
}: {
    code: string;
    lang?: string;
    inRow?: boolean;
    className?: string;
}) {
    const tokens = highlight(code, lang);
    return (
        <div
            className={cx(
                "flex items-start border-(length:--hairline) border-line bg-surface",
                className,
            )}
        >
            <pre
                className={cx(
                    "min-w-0 flex-1 overflow-x-auto pl-(--space-4) font-mono text-(length:--ui-size) leading-(--ui-line) whitespace-pre",
                    inRow
                        ? "py-[calc((var(--button)-var(--ui-line))/2-var(--hairline))] phone:wrap-anywhere phone:whitespace-pre-wrap phone:py-(--space-3)"
                        : "py-(--space-3)",
                )}
            >
                <code>
                    {tokens
                        ? tokens.map((token, i) =>
                              token.kind === "plain" ? (
                                  token.text
                              ) : (
                                  <span key={i} className={colourOf(token)}>
                                      {token.text}
                                  </span>
                              ),
                          )
                        : code}
                </code>
            </pre>
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
