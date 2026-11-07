import type { ReactNode } from "react";
import { Band, Frame } from "../shell/frame";

/**
 * Two panels side by side with a hairline between them, stacked on tablets. The line is the
 * grid's background showing through its gap, as in the headline grid.
 */
export function Panels({ children }: { children: ReactNode }) {
    return (
        <Band rail={false}>
            <Frame padded={false}>
                <div className="grid grid-cols-2 gap-(--hairline) bg-line tablet:grid-cols-1">
                    {children}
                </div>
            </Frame>
        </Band>
    );
}

/** Pads to the frame's edge on both sides, so each panel's text lines up with every band's. */
export function Panel({ children }: { children: ReactNode }) {
    return (
        <div className="relative min-h-(--box) min-w-0 bg-bg px-(--pad) py-(--space-6)">
            {children}
        </div>
    );
}

export function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
    return (
        <h2 id={id} className="text-(length:--ui-size) leading-(--ui-line) font-semibold">
            {children}
        </h2>
    );
}

/** Label above value, each value on a fixed line box so data arriving moves nothing. */
export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
    return (
        <dl className="grid content-start gap-(--space-4)">
            {items.map((item) => (
                <div key={item.label}>
                    <dt className="text-(length:--fine-size) leading-(--fine-line) text-text-muted">
                        {item.label}
                    </dt>
                    <dd className="mt-(--space-1) flex h-(--ui-line) items-baseline gap-(--space-2) font-mono text-(length:--ui-size) leading-(--ui-line) whitespace-nowrap tabular-nums">
                        {item.value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
