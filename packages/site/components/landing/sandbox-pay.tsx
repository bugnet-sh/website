import { useId, type ComponentType } from "react";
import { cx } from "../../lib/cx";
import { Band, Frame } from "../shell/frame";
import { AllowanceArt, FindArt, LimitArt } from "./art/pay-art";
import { cellInset } from "./inset";
import { LandingTitle } from "./title";

/**
 * True to the x402-in-sandboxes spec (docs/superpowers/specs/2026-11-06-x402-in-sandboxes-design.md):
 * the goal of 2.1, the ceilings of X7 and X15, and the refund rule of X9.
 */
export const payItems: { title: string; text: string; Art: ComponentType }[] = [
    {
        title: "No API key needed",
        text: "When the code needs an API you have no key for, your agent finds a similar one that takes x402 payments and points the code at it.",
        Art: FindArt,
    },
    {
        title: "Paid call by call",
        text: "The code pays each call from your allowance without asking you, and no wallet key ever enters the sandbox.",
        Art: AllowanceArt,
    },
    {
        title: "Capped and refunded",
        text: "Payments stop at your limits, and never pass 0.50 USDC a call or 5 USDC per sandbox. Anything left over goes back to your wallet when the sandbox ends, if it's 0.01 USDC or more.",
        Art: LimitArt,
    },
];

/**
 * Code in the sandbox paying x402 APIs from an allowance the user approves once: a heading in two
 * tones, then three cells, each with its drawing over its text, the drawings joined by one line.
 * Stacked, the cells no longer meet, so each drawing cuts the line at its own edges.
 */
export function SandboxPay() {
    const id = useId();
    return (
        <Band as="div" id="sandbox-pay" rail={false}>
            <Frame padded={false}>
                <section aria-labelledby={id}>
                    <div className="px-(--pad) pt-(--band) pb-(--space-7)">
                        <LandingTitle id={id}>
                            Your sandbox pays for the APIs it needs.{" "}
                            <span className="block text-text-muted">
                                You approve one allowance in USDC on{" "}
                                <span className="bg-[linear-gradient(90deg,var(--solana-purple),var(--solana-green))] bg-clip-text text-transparent">
                                    Solana
                                </span>
                                , not every call.
                            </span>
                        </LandingTitle>
                    </div>
                    <ul className="art-money grid grid-cols-3 gap-(--hairline) border-t-(length:--hairline) border-line bg-line tablet:grid-cols-1">
                        {payItems.map(({ title, text, Art }, i) => (
                            <li key={title} className="flex flex-col bg-bg">
                                <div className="art-glow flex justify-center overflow-hidden pt-(--space-6) tablet:[--art-overflow:hidden]">
                                    <Art />
                                </div>
                                <div
                                    className={cx(
                                        "pt-(--space-5) pb-(--space-6)",
                                        cellInset(i, 3, 3),
                                        "tablet:pr-(--pad) tablet:pl-(--pad)",
                                    )}
                                >
                                    <h3 className="text-(length:--cell-title-size) leading-(--cell-title-line) font-semibold">
                                        {title}
                                    </h3>
                                    <p className="mt-(--space-2) max-w-[44ch] text-(length:--lead-size) leading-(--lead-line) text-text-muted">
                                        {text}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            </Frame>
        </Band>
    );
}
