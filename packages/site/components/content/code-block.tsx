import { highlight, type TokenKind } from "../../lib/content/highlight";
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

/**
 * A fenced block: one line per line, scrolled sideways when long, with Copy beside it. A shell or
 * JSON block is coloured by token; any other language shows as plain text.
 */
export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
    const tokens = highlight(code, lang);
    return (
        <div className="mt-(--space-4) flex items-start border-(length:--hairline) border-line bg-surface first:mt-0">
            <pre className="min-w-0 flex-1 overflow-x-auto py-(--space-3) pl-(--space-4) font-mono text-(length:--ui-size) leading-(--ui-line) whitespace-pre">
                <code>
                    {tokens
                        ? tokens.map((token, i) =>
                              token.kind === "plain" ? (
                                  token.text
                              ) : (
                                  <span key={i} className={colours[token.kind]}>
                                      {token.text}
                                  </span>
                              ),
                          )
                        : code}
                </code>
            </pre>
            {/* Centred on the first line: 8 px + half a 28 px button = 12 px + half a 20 px line */}
            <div className="shrink-0 p-(--space-2)">
                <CopyButton text={code} label="Copy code" icon />
            </div>
        </div>
    );
}
