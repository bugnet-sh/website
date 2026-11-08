import { ArrowRight } from "lucide-react";
import { siteHref } from "../../lib/content/href";

export type NextStep = { href: string; title: string; text: string };

/**
 * Where to read next, as a grid of linked cards that share their hairlines: two columns, one on
 * phones. An odd last card spans the row, so no empty cell shows.
 */
export function NextSteps({ steps }: { steps: NextStep[] }) {
    return (
        <ul className="mt-(--prose-gap) grid grid-cols-2 gap-(--hairline) border-(length:--hairline) border-line bg-line first:mt-0 phone:grid-cols-1 [&>li:last-child:nth-child(odd)]:col-span-2 phone:[&>li:last-child:nth-child(odd)]:col-span-1">
            {steps.map((step) => (
                <li key={step.href} className="flex bg-bg">
                    <a
                        href={siteHref(step.href)}
                        className="group flex w-full flex-col px-(--space-5) py-(--space-4) hover:bg-surface"
                    >
                        <span className="flex items-center justify-between gap-(--space-3) text-text group-hover:text-accent">
                            {step.title}
                            <ArrowRight
                                aria-hidden="true"
                                className="block size-(--arrow) shrink-0"
                            />
                        </span>
                        <span className="mt-(--space-1) text-(length:--ui-size) leading-(--ui-line) text-text-muted">
                            {step.text}
                        </span>
                    </a>
                </li>
            ))}
        </ul>
    );
}
