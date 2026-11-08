import { useId, type ReactNode } from "react";
import { Band, Frame } from "../shell/frame";
import { Tip } from "../ui/tip";
import { cellInset } from "./inset";
import { LandingTitle } from "./title";

const muted = "text-text-muted";

/**
 * A terminal joined to the foot of its step: no heading and no margin, so the cell's hairlines are
 * its edges, and its lines start where the step's text does. Top-aligned, so the first lines of a
 * row share one baseline whatever each terminal holds.
 */
function Card({ inset, children }: { inset: string; children: ReactNode }) {
    return (
        // A picture of the step; the title and sentence above it say the same in words
        <div
            aria-hidden
            className={`mt-auto flex h-(--how-mock) flex-col gap-(--space-2) pt-(--space-3) overflow-hidden border-t-(length:--hairline) border-line bg-surface font-mono text-(length:--fine-size) leading-(--fine-line) whitespace-nowrap ${inset}`}
        >
            {children}
        </div>
    );
}

/** A label and its value on one line of a card; the label is padded so the values align. */
function Line({ label, children }: { label: string; children: ReactNode }) {
    return (
        <p className="whitespace-pre">
            <span className={muted}>{label.padEnd(8)}</span>
            {children}
        </p>
    );
}

const chip =
    "inline-flex h-(--tip-button) items-center px-(--space-2) font-ui font-semibold tracking-normal";

const steps: { title: string; text: string; tip: string; lines: ReactNode }[] = [
    {
        title: "Ask",
        text: "Ask your agent to run something in a sandbox.",
        tip: "It checks for free first with bugnet_assess.",
        lines: (
            <>
                <p>
                    <span className={muted}>&gt;</span> Try this repo in a sandbox.
                </p>
                <p>
                    <span className="text-accent-3">bugnet_assess</span>{" "}
                    <span className="text-accent">free</span>
                </p>
            </>
        ),
    },
    {
        title: "Approve",
        text: "Your agent names the size and price. You approve the call.",
        tip: "Bugnet refuses a call whose price isn't the exact price of that size.",
        lines: (
            <>
                <p>2 vCPU 2 GiB 10 min</p>
                <p className="text-accent-2">0.05 USDC</p>
                <p className="flex gap-(--space-2)">
                    <span className={`${chip} bg-accent text-accent-ink`}>Approve</span>
                    <span className={`${chip} border-(length:--hairline) border-line ${muted}`}>
                        Deny
                    </span>
                </p>
            </>
        ),
    },
    {
        title: "Pay",
        text: "Pay in USDC on Solana, by link or from your wallet.",
        tip: "x402: no account, no API key.",
        lines: (
            <>
                <Line label="order">
                    <span className="text-accent-2">0.05 USDC</span>
                </Line>
                <Line label="tx">4vJ9…Kq2L</Line>
                <Line label="status">
                    <span className="text-accent">paid</span>
                </Line>
            </>
        ),
    },
    {
        title: "Run",
        text: "Commands run in a fresh cloud sandbox. Results come back.",
        tip: "The sandbox is deleted at the deadline.",
        lines: (
            <>
                <p className="flex justify-between gap-(--space-3)">
                    <span>
                        <span className={muted}>$</span> npm test
                    </span>
                    <span>09:58</span>
                </p>
                <p className="text-accent">✓ 42 passed</p>
                <p className={muted}>$</p>
            </>
        ),
    },
];

/** Four steps in a hairline grid: a title, one sentence, then a terminal joined to the cell's foot. */
export function How() {
    const id = useId();
    return (
        <Band as="div" id="how" rail={false}>
            <Frame padded={false}>
                <section aria-labelledby={id}>
                    <div className="px-(--pad) pt-(--band) pb-(--space-6)">
                        <LandingTitle id={id}>How it works</LandingTitle>
                    </div>
                    <ol className="grid grid-cols-4 gap-(--hairline) border-t-(length:--hairline) border-line bg-line narrow:grid-cols-2 phone:grid-cols-1">
                        {steps.map((step, i) => (
                            <li key={step.title} className="flex flex-col bg-bg">
                                {/* Positioned: the tip opens under the title, over the sentence */}
                                <div
                                    className={`relative flex items-center gap-(--space-2) pt-(--space-6) ${cellInset(i, 4, 2)}`}
                                >
                                    <h3 className="text-(length:--lead-size) leading-(--lead-line) font-semibold">
                                        <span className="mr-(--space-2) font-mono text-text-muted">
                                            {String(i + 1).padStart(2, "0")}
                                        </span>
                                        {step.title}
                                    </h3>
                                    <Tip text={step.tip} label={`About ${step.title}`} />
                                </div>
                                <p
                                    className={`mt-(--space-2) pb-(--space-6) text-(length:--ui-size) leading-(--ui-line) text-text-muted ${cellInset(i, 4, 2)}`}
                                >
                                    {step.text}
                                </p>
                                <Card inset={cellInset(i, 4, 2)}>{step.lines}</Card>
                            </li>
                        ))}
                    </ol>
                </section>
            </Frame>
        </Band>
    );
}
