import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
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

/**
 * Pads to the frame's edge, so each panel's text lines up with every band's. The second panel's
 * text starts one gap after the hairline between them, as the headline cells' do; stacked, it
 * pads to the frame's edge again.
 */
export function Panel({
    children,
    second = false,
    className,
}: {
    children: ReactNode;
    second?: boolean;
    className?: string;
}) {
    return (
        <div
            className={cx(
                "relative min-h-(--box) min-w-0 bg-bg px-(--pad) py-(--space-6)",
                second && "pl-(--space-5) tablet:pl-(--pad)",
                className,
            )}
        >
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
export function Facts({
    items,
    columns = false,
}: {
    items: { label: string; value: ReactNode }[];
    /** Side by side in one row, stacked again on phones. */
    columns?: boolean;
}) {
    return (
        <dl
            className={cx(
                "grid content-start gap-(--space-4)",
                columns && "grid-flow-col auto-cols-fr gap-x-(--space-5) phone:grid-flow-row",
            )}
        >
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
