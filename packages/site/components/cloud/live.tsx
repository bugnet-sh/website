import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { formatStartMs } from "../../lib/stats/labels";
import type { ProviderRow } from "../../lib/stats/types";
import { formatCount } from "../../lib/stats/view";
import { Cell, cells } from "./cell";

/**
 * A provider's numbers from the feed. The feed leaves out a provider with no start, no running
 * sandbox and no start time in 7 days, so a missing row is a provider with nothing to count.
 */
export function rowOf(rows: readonly ProviderRow[], provider: string): ProviderRow {
    return (
        rows.find((p) => p.provider === provider) ?? {
            provider,
            sandboxes7d: 0,
            active: 0,
            startP50Ms: null,
            startP95Ms: null,
            failed7d: 0,
        }
    );
}

const muted = (text: string) => <span className="text-text-muted">{text}</span>;

const items: { label: string; value: (row: ProviderRow) => ReactNode }[] = [
    { label: "Running now", value: (row) => formatCount(row.active) },
    { label: "Sandboxes in 7 days", value: (row) => formatCount(row.sandboxes7d) },
    {
        label: "Median start",
        // Under 5 samples the feed sends no percentile
        value: (row) =>
            row.startP50Ms === null ? muted("Under 5 starts") : formatStartMs(row.startP50Ms),
    },
    {
        label: "Failed in 7 days",
        value: (row) => (row.failed7d === null ? muted("Unavailable") : formatCount(row.failed7d)),
    },
];

/** The provider's live numbers, a tinted row on the same columns as the specs above it */
export function LiveNumbers({ row }: { row: ProviderRow }) {
    return (
        <dl className={cx(cells, "border-t-(length:--hairline) border-line")}>
            {items.map((item) => (
                <Cell key={item.label} label={item.label} className="bg-surface">
                    {item.value(row)}
                </Cell>
            ))}
        </dl>
    );
}
