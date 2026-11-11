import type { ReactNode } from "react";
import type { SummaryState } from "../../lib/stats/client";
import { formatStartMs } from "../../lib/stats/labels";
import type { ProviderRow } from "../../lib/stats/types";
import { formatCount } from "../../lib/stats/view";
import { isUnavailable } from "../stats/unavailable";

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

const muted = (text: string) => <span className="font-ui text-text-muted">{text}</span>;

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

/** The provider's live numbers, each on a fixed line so data arriving moves nothing */
export function LiveNumbers({ live }: { live: Live }) {
    return (
        <dl className="flex flex-wrap gap-x-(--space-5) gap-y-(--space-1)">
            {items.map((item) => (
                <div key={item.label} className="flex items-baseline gap-(--space-1)">
                    <dt className="text-text-muted">{item.label}:</dt>
                    <dd className="h-(--fine-line) min-w-(--space-4) font-mono whitespace-nowrap">
                        {live.kind === "row"
                            ? item.value(live.row)
                            : live.kind === "unavailable" && muted("Unavailable")}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
