import { useId } from "react";
import { Band, Frame } from "../shell/frame";
import { HowPlayer } from "./how-player";
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
type Line = Run[];

const run =
    (tone: Tone) =>
    (text: string): Run => ({ tone, text });
const t = run("text");
const m = run("muted");
const money = run("money");
const ok = run("ok");

const prompt = (text: string): Line => [m("> "), t(text)];
const call = (dot: Tone, tool: string, args: string): Line => [
    { tone: dot, text: "● " },
    { tone: "tool", text: tool },
    m(args),
];
const result = (...runs: Run[]): Line => [
    m("  "),
    { tone: "muted", text: "⎿", cell: true },
    m("  "),
    ...runs,
];
const more = (...runs: Run[]): Line => [m("     "), ...runs];

/** Claude Code's transcript of each step, true to the tools and to paying.md */
const steps: { title: string; text: string; lines: Line[] }[] = [
    {
        title: "Ask",
        text: "Ask your agent to run something in a sandbox.",
        lines: [
            [m("$ "), { tone: "claude", text: "claude" }],
            prompt("Test this in a sandbox"),
            [],
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
            [m('  packageId: "'), t("small-10m"), m('",')],
            [m('  confirmPriceUsd: "'), money("0.05"), m('")')],
            [],
            [t("Do you want to proceed?")],
            [
                { tone: "tool", text: "❯", cell: true },
                { tone: "tool", text: " 1. Yes" },
            ],
            [m("  2. No")],
        ],
    },
    {
        title: "Pay",
        text: "Pay in USDC on Solana, by link or from your wallet.",
        lines: [
            [t("● Pay "), money("0.05 USDC"), t(" on Solana")],
            [t("  pay.bugnet.sh/o/ord_7Kq2")],
            [],
            prompt("Paid"),
            [],
            call("ok", "bugnet_redeem", "(ord_7Kq2)"),
            result(ok("paid"), m("  tx "), t("4vJ9…Kq2L")),
        ],
    },
    {
        title: "Run",
        text: "Commands run in a fresh cloud sandbox. Results come back.",
        lines: [
            [...call("ok", "bugnet_exec", "("), t("npm test"), m(")")],
            result(m("exit "), t("0")),
            more(t("Tests: "), ok("42 passed")),
            [],
            call("ok", "bugnet_status", ""),
            result(m("deleted in "), t("9 min")),
        ],
    },
];

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
                    <p
                        key={j}
                        data-how-line={line.length > 0 ? "" : undefined}
                        className="h-(--how-code-line) data-caret:after:text-text-muted data-caret:after:content-['█'] data-off:invisible"
                    >
                        {line.map((r, k) => (
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
                    <HowPlayer className="grid grid-cols-4 gap-(--hairline) border-t-(length:--hairline) border-line bg-line narrow:grid-cols-2 phone:grid-cols-1">
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
