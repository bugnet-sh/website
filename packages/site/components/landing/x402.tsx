import { useId } from "react";
import { cx } from "../../lib/cx";
import { Band, Frame } from "../shell/frame";
import { secondaryButton } from "../ui/button";
import { DitherLogo } from "./dither-logo/dither-logo";
import { LandingTitle } from "./title";

const facts = [
    "Your agent asks for a sandbox, Bugnet names the price, and the sandbox starts once you pay. That's x402, an open standard for paying on the web.",
    "You pay in USDC on Solana, and the payment clears in seconds.",
    "Pay through a link with any Solana wallet, or from your phone in Phantom or Solflare.",
];

/** Why there is no account: the text and its facts left, the logo right, stacked on tablets. */
export function X402() {
    const id = useId();
    return (
        <Band as="div" id="x402" rail={false}>
            <Frame padded={false}>
                <section
                    aria-labelledby={id}
                    className="grid grid-cols-2 gap-(--hairline) bg-line tablet:grid-cols-1"
                >
                    <div className="flex flex-col justify-center bg-bg px-(--pad) py-(--band)">
                        <LandingTitle id={id}>No account. Pay per run on Solana.</LandingTitle>
                        <ul className="mt-(--space-6) border-t-(length:--hairline) border-line">
                            {facts.map((fact) => (
                                <li
                                    key={fact}
                                    className="border-b-(length:--hairline) border-line py-(--space-4) text-(length:--lead-size) leading-(--lead-line)"
                                >
                                    {fact}
                                </li>
                            ))}
                        </ul>
                        <a
                            href="/docs/paying/"
                            className={cx(secondaryButton, "mt-(--space-6) self-start")}
                        >
                            How paying works
                        </a>
                    </div>
                    {/* At least this tall, and as tall as the text when that is taller */}
                    <div className="relative min-h-(--x402-figure) overflow-hidden bg-bg tablet:min-h-(--x402-figure-phone)">
                        <DitherLogo />
                    </div>
                </section>
            </Frame>
        </Band>
    );
}
