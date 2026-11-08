import { useId } from "react";
import { cx } from "../../lib/cx";
import { Band, Frame } from "../shell/frame";
import { SectionTitle } from "../stats/panels";

const steps = [
    { title: "Ask your agent", text: "“Try this repo”" },
    { title: "Approve the price", text: "It checks for free, then asks before it spends." },
    {
        title: "Get the results",
        text: "Output and files come back. The sandbox is deleted at the deadline.",
    },
];

/** Three steps in a hairline grid, stacked on phones. */
export function How() {
    const id = useId();
    return (
        <Band rail={false}>
            <Frame padded={false}>
                <section aria-labelledby={id}>
                    <div className="px-(--pad) pt-(--space-6)">
                        <SectionTitle id={id}>How it works</SectionTitle>
                    </div>
                    <ol className="grid grid-cols-3 gap-(--hairline) bg-line phone:grid-cols-1">
                        {steps.map((step, i) => (
                            <li
                                key={step.title}
                                // As the stats headline: the first column pads to the frame's edge
                                className={cx(
                                    "bg-bg pt-(--space-4) pb-(--space-6) phone:px-(--pad)",
                                    i === 0 ? "px-(--pad)" : "px-(--space-5)",
                                )}
                            >
                                <span className="font-mono text-(length:--fine-size) leading-(--fine-line) text-text-muted">
                                    {i + 1}
                                </span>
                                <h3 className="mt-(--space-2) text-(length:--lead-size) leading-(--lead-line) font-semibold">
                                    {step.title}
                                </h3>
                                <p className="mt-(--space-1) text-(length:--ui-size) leading-(--ui-line) text-text-muted">
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
