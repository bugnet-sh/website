import { useId, type ComponentType } from "react";
import { cx } from "../../lib/cx";
import { Band, Frame } from "../shell/frame";
import { secondaryButton } from "../ui/button";
import { DataArt, DeadlineArt, OffMachineArt } from "./art/safety-art";
import { cellInset } from "./inset";
import { LandingTitle } from "./title";

/** Each cell restates a fact from the docs' Safety page, its sentence adding to its title */
export const safetyFacts: { title: string; text: string; Art: ComponentType }[] = [
    {
        title: "Runs on a cloud machine",
        text: "It can't reach your files, your keys or your local network.",
        Art: OffMachineArt,
    },
    {
        title: "Deleted at the deadline",
        text: "Everything in it goes too, so download what you need before then.",
        Art: DeadlineArt,
    },
    {
        title: "Output comes back as data",
        text: "Bugnet strips escape codes and hidden characters, and keeps the last 8 KiB of each stream.",
        Art: DataArt,
    },
];

/**
 * Why running untrusted code here is safe: a heading in two tones with the Safety link at its
 * right, then three cells in a hairline grid, each with its fact over a green line drawing.
 */
export function Safety() {
    const id = useId();
    return (
        <Band as="div" id="safety" rail={false}>
            <Frame padded={false}>
                <section aria-labelledby={id}>
                    <div className="flex items-start justify-between gap-(--space-5) px-(--pad) pt-(--band) pb-(--space-7) tablet:flex-col">
                        <LandingTitle id={id}>
                            Untrusted code stays in the sandbox.{" "}
                            <span className="block text-text-muted">
                                Run code you wouldn't trust on your own laptop.
                            </span>
                        </LandingTitle>
                        <a href="/docs/safety/" className={secondaryButton}>
                            Safety
                        </a>
                    </div>
                    <ul className="grid grid-cols-3 gap-(--hairline) border-t-(length:--hairline) border-line bg-line tablet:grid-cols-1">
                        {safetyFacts.map(({ title, text, Art }, i) => (
                            <li key={title} className="flex flex-col bg-bg">
                                <div
                                    className={cx(
                                        "pt-(--space-6)",
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
                                <div className="art-glow mt-auto flex justify-center px-(--space-5) pt-(--space-7) pb-(--space-6)">
                                    <Art />
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            </Frame>
        </Band>
    );
}
