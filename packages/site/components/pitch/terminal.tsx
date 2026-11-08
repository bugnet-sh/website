import { cx } from "../../lib/cx";

const tones = {
    text: "text-text",
    muted: "text-text-muted",
    tool: "text-accent-3",
    money: "text-accent-2",
    ok: "text-accent",
    claude: "text-claude",
    bad: "text-bad",
};

type Tone = keyof typeof tones;
// The mono face has no ⎿ or ❯, so a fallback face draws them in a cell one character wide
type Run = { tone: Tone; text: string; cell?: boolean };
export type Line = Run[];

const run =
    (tone: Tone) =>
    (text: string): Run => ({ tone, text });
export const t = run("text");
export const m = run("muted");
export const money = run("money");
export const ok = run("ok");
export const bad = run("bad");
export const tool = run("tool");

export const blank: Line = [];
export const shell = (): Line => [m("$ "), { tone: "claude", text: "claude" }];
export const prompt = (text: string): Line => [m("> "), t(text)];
export const say = (...runs: Run[]): Line => [t("● "), ...runs];
export const call = (name: string, args: string, dot: Tone = "ok"): Line => [
    { tone: dot, text: "● " },
    tool(name),
    m(args),
];
export const result = (...runs: Run[]): Line => [
    m("  "),
    { tone: "muted", text: "⎿", cell: true },
    m("  "),
    ...runs,
];
export const more = (...runs: Run[]): Line => [m("     "), ...runs];

/** A Claude Code session, drawn still, in the landing's terminal colours */
export function Terminal({ lines, className }: { lines: Line[]; className?: string }) {
    return (
        <div
            className={cx(
                "border-(length:--hairline) border-line bg-surface px-[2.2cqi] py-[2cqi] font-mono text-[max(11px,1.08cqi)] leading-[1.75] phone:px-(--space-4) phone:py-(--space-4)",
                className,
            )}
        >
            {lines.map((line, i) => (
                <p key={i} className="min-h-[1.75em] whitespace-pre-wrap">
                    {line.map((r, j) => (
                        <span
                            key={j}
                            className={cx(
                                tones[r.tone],
                                r.cell && "inline-block w-[1ch] text-center",
                            )}
                        >
                            {r.text}
                        </span>
                    ))}
                </p>
            ))}
        </div>
    );
}
