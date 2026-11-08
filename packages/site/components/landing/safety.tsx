import { useId } from "react";
import { Band, Frame } from "../shell/frame";
import { secondaryButton } from "../ui/button";
import { cellInset } from "./inset";
import { LandingTitle } from "./title";

// Each line restates a fact from the docs' Safety and Paying pages, in fewer words
const facts = [
    {
        title: "Off your machine",
        text: "Code runs on a cloud machine. It cannot reach your files, keys or network.",
    },
    {
        title: "Gone at the deadline",
        text: "The sandbox and everything in it are deleted when its time ends.",
    },
    {
        title: "Output is data",
        text: "Escape codes and hidden characters are stripped, and output is labelled as data, not instructions.",
    },
    {
        title: "Checked for free",
        text: "Before you pay, fixed rules flag install scripts that fetch binaries, hidden code and model files that run code.",
    },
    {
        title: "No AI on our side",
        text: "Bugnet's server is plain code. It never sees your conversation.",
    },
    {
        title: "You approve every payment",
        text: "Nothing is spent without your approval and your wallet's signature.",
    },
];

/** Why running untrusted code here is safe: six facts in a hairline grid, three to a row. */
export function Safety() {
    const id = useId();
    return (
        <Band as="div" id="safety" rail={false}>
            <Frame padded={false}>
                <section aria-labelledby={id}>
                    <div className="flex flex-wrap items-end justify-between gap-(--space-4) px-(--pad) pt-(--band) pb-(--space-6)">
                        <LandingTitle id={id}>Untrusted code stays in the sandbox.</LandingTitle>
                        <a href="/docs/safety/" className={secondaryButton}>
                            Safety
                        </a>
                    </div>
                    <ul className="grid grid-cols-3 gap-(--hairline) border-t-(length:--hairline) border-line bg-line narrow:grid-cols-2 phone:grid-cols-1">
                        {facts.map((fact, i) => (
                            <li
                                key={fact.title}
                                className={`bg-bg py-(--space-6) ${cellInset(i, 3, 2)}`}
                            >
                                <h3 className="text-(length:--cell-title-size) leading-(--cell-title-line) font-semibold">
                                    {fact.title}
                                </h3>
                                <p className="mt-(--space-2) max-w-[44ch] text-(length:--lead-size) leading-(--lead-line) text-text-muted">
                                    {fact.text}
                                </p>
                            </li>
                        ))}
                    </ul>
                </section>
            </Frame>
        </Band>
    );
}
