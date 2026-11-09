import { CircleDollarSign, Info, Lightbulb, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import type { CalloutKind } from "../../lib/content/parts";

/** A plain quote: a quoted block on the surface colour. */
export function Blockquote({ children }: { children?: ReactNode }) {
    return (
        <blockquote className="mt-(--prose-gap) border-(length:--hairline) border-line bg-surface px-(--space-4) py-(--space-3) first:mt-0">
            {children}
        </blockquote>
    );
}

const kinds = {
    note: { label: "Note", Icon: Info, ink: "text-accent-3", edge: "border-accent-3" },
    tip: { label: "Tip", Icon: Lightbulb, ink: "text-accent", edge: "border-accent" },
    warning: { label: "Warning", Icon: TriangleAlert, ink: "text-warn", edge: "border-warn" },
    // Pink is the site's money colour
    money: {
        label: "Money",
        Icon: CircleDollarSign,
        ink: "text-accent-2",
        edge: "border-accent-2",
    },
} as const;

export function isCalloutKind(kind: unknown): kind is CalloutKind {
    return typeof kind === "string" && Object.hasOwn(kinds, kind);
}

/**
 * A callout: an edge, an icon and a small label in its kind's colour, then the body. A title,
 * when the Markdown gives one, sits beside the label; everything else spans the box below.
 */
export function Callout({ kind, children }: { kind: CalloutKind; children?: ReactNode }) {
    const { label, Icon, ink, edge } = kinds[kind];
    return (
        <div
            role="note"
            className={cx(
                "mt-(--prose-gap) grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-(--space-4) gap-y-(--space-2) border-l-(length:--callout-edge) bg-surface px-(--space-5) py-(--space-4) first:mt-0",
                "[&>*]:col-span-2 [&>*]:mt-0! [&>[data-callout-head]]:col-span-1 [&>[data-callout-title]]:col-span-1",
                edge,
            )}
        >
            <p
                data-callout-head=""
                className={cx(
                    "flex items-baseline gap-(--space-2) text-(length:--fine-size) leading-(--fine-line) tracking-(--caps-tracking) uppercase",
                    ink,
                )}
            >
                <Icon
                    aria-hidden="true"
                    className="block size-(--callout-icon) shrink-0 self-center"
                />
                {label}
            </p>
            {children}
        </div>
    );
}
