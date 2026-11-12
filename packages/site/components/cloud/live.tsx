import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import type { SummaryState } from "../../lib/stats/client";
import { formatStartMs } from "../../lib/stats/labels";
import type { ProviderRow } from "../../lib/stats/types";
import { formatCount } from "../../lib/stats/view";
import { isUnavailable } from "../stats/unavailable";
import { Cell, cells } from "./cell";

const unavailable = "Stats are unavailable right now.";

/** A provider's numbers: still loading, the feed off, or its row */
export type Live =
    { kind: "loading" } | { kind: "unavailable" } | { kind: "row"; row: ProviderRow };

/**
 * The feed leaves out a provider with no start, no running sandbox and no start time in 7 days,
 * so while it answers, a missing row is a provider with nothing to count.
 */
export function liveOf(stats: SummaryState, provider: string): Live {
    if (stats.data) {
        const row = stats.data.providers.find((p) => p.provider === provider) ?? {
            provider,
            sandboxes7d: 0,
            active: 0,
            startP50Ms: null,
            startP95Ms: null,
            failed7d: 0,
        };
        return { kind: "row", row };
    }
    return isUnavailable(stats) ? { kind: "unavailable" } : { kind: "loading" };
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

/**
 * The provider's live numbers, a tinted row on the same columns as the specs above it. Each cell
 * keeps its height while it loads, and a feed that is off covers the row with one line, so data
 * arriving moves nothing.
 */
export function LiveNumbers({ live }: { live: Live }) {
    const off = live.kind === "unavailable";
    return (
        <div className="relative border-t-(length:--hairline) border-line">
            <dl aria-hidden={off || undefined} className={cells}>
                {items.map((item) => (
                    <Cell
                        key={item.label}
                        label={item.label}
                        className={cx("bg-surface", off && "invisible")}
                    >
                        {/* A space while there is no value keeps the cell's height */}
                        {live.kind === "row" ? item.value(live.row) : " "}
                    </Cell>
                ))}
            </dl>
            {off && (
                <p className="absolute inset-0 flex items-center bg-surface px-(--space-5) text-(length:--ui-size) leading-(--ui-line) text-text-muted phone:px-(--space-4)">
                    {unavailable}
                </p>
            )}
        </div>
    );
}
