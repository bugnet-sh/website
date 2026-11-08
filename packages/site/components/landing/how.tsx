import { useId } from "react";
import { Band, Frame } from "../shell/frame";
import { HowPlayer } from "./how-player";
import type { Kind, Line as Measured } from "./how-timeline";
import { cellInset } from "./inset";
import { LandingTitle } from "./title";

const tones = {
    text: "",
    muted: "text-text-muted",
    tool: "text-accent-3",
    money: "text-accent-2",
    ok: "text-accent",
    claude: "text-claude",
};

type Tone = keyof typeof tones;
// The mono face has no ⎿ or ❯, so a fallback face draws them in a cell one character wide
type Run = { tone: Tone; text: string; cell?: boolean };
type Line = { kind: Kind; runs: Run[] };

const run =
    (tone: Tone) =>
    (text: string): Run => ({ tone, text });
const t = run("text");
const m = run("muted");
const money = run("money");
const ok = run("ok");

/** Typed after a pause, its first run (a prompt or a bullet) at once */
const entry = (...runs: Run[]): Line => ({ kind: "type", runs });
/** Typed on from the line above */
const on = (...runs: Run[]): Line => ({ kind: "more", runs });
/** Printed whole */
const out = (...runs: Run[]): Line => ({ kind: "print", runs });
const blank = out();

const prompt = (text: string) => entry(m("> "), t(text));
const call = (dot: Tone, tool: string, args: string, ...rest: Run[]) =>
    entry({ tone: dot, text: "● " }, { tone: "tool", text: tool }, m(args), ...rest);
const result = (...runs: Run[]) =>
    out(m("  "), { tone: "muted", text: "⎿", cell: true }, m("  "), ...runs);
const more = (...runs: Run[]) => out(m("     "), ...runs);

/** Claude Code's transcript of each step, true to the tools and to paying.md */
const steps: { title: string; text: string; lines: Line[] }[] = [
    {
        title: "Ask",
        text: "Ask your agent to run something in a sandbox.",
        lines: [
            entry(m("$ "), { tone: "claude", text: "claude" }),
            prompt("Test this in a sandbox"),
            blank,
            call("ok", "bugnet_assess", "(repo)"),
            result(m("fits   "), t("small-10m")),
            more(m("price  "), money("0.05 USDC")),
            more(m("check  "), ok("free")),
        ],
    },
    {
        title: "Approve",
        text: "Your agent names the size and price. You approve the call.",
        lines: [
            call("muted", "bugnet_start", "("),
            on(m('  packageId: "'), t("small-10m"), m('",')),
            on(m('  confirmPriceUsd: "'), money("0.05"), m('")')),
            blank,
            out(t("Do you want to proceed?")),
            out({ tone: "tool", text: "❯", cell: true }, { tone: "tool", text: " 1. Yes" }),
            out(m("  2. No")),
        ],
    },
    {
        title: "Pay",
        text: "Pay in USDC on Solana, by link or from your wallet.",
        lines: [
            entry(t("● "), t("Pay "), money("0.05 USDC"), t(" on Solana")),
            on(t("  pay.bugnet.sh/o/ord_7Kq2")),
            blank,
            prompt("Paid"),
            blank,
            call("ok", "bugnet_redeem", "(ord_7Kq2)"),
            result(ok("paid"), m("  tx "), t("4vJ9…Kq2L")),
        ],
    },
    {
        title: "Run",
        text: "Commands run in a fresh cloud sandbox. Results come back.",
        lines: [
            call("ok", "bugnet_exec", "(", t("npm test"), m(")")),
            result(m("exit "), t("0")),
            more(t("Tests: "), ok("42 passed")),
            blank,
            call("ok", "bugnet_status", ""),
            result(m("deleted in "), t("9 min")),
        ],
    },
];

/** A line's length, and what shows at once when it is typed: its prompt or bullet, or its indent */
function measure({ kind, runs }: Line): Measured {
    const text = runs.map((r) => r.text).join("");
    const indent = text.length - text.trimStart().length;
    const lead = { type: runs[0]?.text.length ?? 0, more: indent, print: 0 }[kind];
    return { kind, chars: text.length, lead };
}

/** Each step's terminal as the player types it */
export const terminals = steps.map((step) => step.lines.map(measure));

/** A terminal joined to the foot of its step, its lines starting where the step's text does */
function Terminal({ lines, inset }: { lines: Line[]; inset: string }) {
    return (
        // A picture of the step, which its title and sentence say in words
        <div
            aria-hidden
            data-how-term
            className="relative mt-auto h-(--how-term) border-t-(length:--hairline) border-line bg-surface"
        >
            <span
                data-how-bar
                className="absolute inset-x-0 -top-(--hairline) h-(--ring) origin-left scale-x-0 bg-accent"
            />
            <div
                className={`h-full overflow-hidden pt-(--space-5) font-mono text-(length:--how-code-size) leading-(--how-code-line) whitespace-pre ${inset}`}
            >
                {lines.map((line, j) => (
                    // Clipped to its height: the cursor glyph is taller than the line, and what
                    // it paints above is not always cleared when the cursor moves on
                    <p
                        key={j}
                        data-how-line
                        className="h-(--how-code-line) overflow-y-clip data-caret:after:text-text-muted data-caret:after:content-['█'] data-off:invisible"
                    >
                        {line.runs.map((r, k) => (
                            <span
                                key={k}
                                className={
                                    r.cell
                                        ? `inline-block w-[1ch] text-center ${tones[r.tone]}`
                                        : tones[r.tone] || undefined
                                }
                            >
                                {r.text}
                            </span>
                        ))}
                    </p>
                ))}
            </div>
        </div>
    );
}

/** Four steps in a hairline grid, each a number, a title and a sentence over its terminal */
export function How() {
    const id = useId();
    return (
        <Band as="div" id="how" rail={false}>
            <Frame padded={false}>
                <section aria-labelledby={id}>
                    <div className="px-(--pad) pt-(--band) pb-(--space-6)">
                        <LandingTitle id={id}>How it works</LandingTitle>
                    </div>
                    <HowPlayer
                        lines={terminals}
                        className="grid grid-cols-4 gap-(--hairline) border-t-(length:--hairline) border-line bg-line narrow:grid-cols-2 phone:grid-cols-1"
                    >
                        {steps.map((step, i) => {
                            const inset = cellInset(i, 4, 2);
                            return (
                                <li
                                    key={step.title}
                                    data-how-step
                                    className="group/step flex flex-col bg-bg"
                                >
                                    <div className={`py-(--space-6) ${inset}`}>
                                        <span
                                            aria-hidden
                                            className="block font-head text-(length:--how-number-size) leading-(--how-number-line) font-extralight text-text-muted transition-colors duration-300 group-data-playing/step:text-accent"
                                        >
                                            {String(i + 1).padStart(2, "0")}
                                        </span>
                                        <h3 className="mt-(--space-5) text-(length:--cell-title-size) leading-(--cell-title-line) font-semibold">
                                            {step.title}
                                        </h3>
                                        <p className="mt-(--space-2) text-(length:--lead-size) leading-(--lead-line) text-text-muted">
                                            {step.text}
                                        </p>
                                    </div>
                                    <Terminal lines={step.lines} inset={inset} />
                                </li>
                            );
                        })}
                    </HowPlayer>
                </section>
            </Frame>
        </Band>
    );
}
