import { useId, type ReactNode } from "react";
import { Band, Frame } from "../shell/frame";
import { Tip } from "../ui/tip";
import { cellInset } from "./inset";
import { LandingTitle } from "./title";

const muted = "text-text-muted";

/** A small window onto the step: its number and name, then a few literal lines. */
function Card({ tag, aside, children }: { tag: string; aside?: ReactNode; children: ReactNode }) {
    return (
        // A picture of the step; the title and sentence under it say the same in words
        <div
            aria-hidden
            className="border-(length:--hairline) border-line bg-surface font-mono text-(length:--fine-size) leading-(--fine-line) whitespace-nowrap"
        >
            <div className="flex h-(--segment) items-center justify-between border-b-(length:--hairline) border-line px-(--space-3) tracking-(--caps-tracking) text-text-muted uppercase">
                <span>{tag}</span>
                {aside}
            </div>
            <div className="flex h-(--how-mock) flex-col justify-center gap-(--space-2) overflow-hidden px-(--space-3)">
                {children}
            </div>
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

const steps: { title: string; text: string; tip: string; card: ReactNode }[] = [
    {
        title: "Ask",
        text: "Ask your agent to run something in a sandbox.",
        tip: "It checks for free first with bugnet_assess.",
        card: (
            <Card tag="01 Ask">
                <p>
                    <span className={muted}>&gt;</span> Try this repo in a sandbox.
                </p>
                <p className="text-accent-3">bugnet_assess</p>
            </Card>
        ),
    },
    {
        title: "Approve",
        text: "Your agent names the size and price. You approve the call.",
        tip: "Bugnet refuses a call whose price isn't the exact price of that size.",
        card: (
            <Card tag="02 Approve">
                <p>2 vCPU 2 GiB 10 min</p>
                <p className="text-accent-2">0.05 USDC</p>
                <p className="flex gap-(--space-2)">
                    <span className={`${chip} bg-accent text-accent-ink`}>Approve</span>
                    <span className={`${chip} border-(length:--hairline) border-line ${muted}`}>
                        Deny
                    </span>
                </p>
            </Card>
        ),
    },
    {
        title: "Pay",
        text: "Pay in USDC on Solana, by link or from your wallet.",
        tip: "x402: no account, no API key.",
        card: (
            <Card tag="03 Pay">
                <Line label="order">
                    <span className="text-accent-2">0.05 USDC</span>
                </Line>
                <Line label="tx">4vJ9…Kq2L</Line>
                <Line label="status">
                    <span className="text-accent">paid</span>
                </Line>
            </Card>
        ),
    },
    {
        title: "Run",
        text: "Commands run in a fresh cloud sandbox. Results come back.",
        tip: "The sandbox is deleted at the deadline.",
        card: (
            <Card tag="04 Run" aside={<span className="text-text">09:58</span>}>
                <p>
                    <span className={muted}>$</span> npm test
                </p>
                <p className="text-accent">✓ 42 passed</p>
                <p className={muted}>$</p>
            </Card>
        ),
    },
];

/** Four steps in a hairline grid: a card that shows the step, then its title and one sentence. */
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
                            <li
                                key={step.title}
                                className={`bg-bg py-(--space-6) ${cellInset(i, 4, 2)}`}
                            >
                                {step.card}
                                {/* Positioned, so the tip opens under the title, over the sentence */}
                                <div className="relative mt-(--space-5) flex items-center gap-(--space-2)">
                                    <h3 className="text-(length:--lead-size) leading-(--lead-line) font-semibold">
                                        <span className="mr-(--space-2) font-mono text-text-muted">
                                            {String(i + 1).padStart(2, "0")}
                                        </span>
                                        {step.title}
                                    </h3>
                                    <Tip text={step.tip} label={`About ${step.title}`} />
                                </div>
                                <p className="mt-(--space-2) text-(length:--ui-size) leading-(--ui-line) text-text-muted">
                                    {step.text}
                                </p>
                            </li>
                        ))}
                    </ol>
                </section>
            </Frame>
        </Band>
    );
}
