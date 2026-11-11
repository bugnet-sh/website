import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import type { SummaryState } from "../../lib/stats/client";
import { formatStartMs } from "../../lib/stats/labels";
import type { ProviderRow } from "../../lib/stats/types";
import { formatCount } from "../../lib/stats/view";
import { isUnavailable } from "../stats/unavailable";

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

const muted = (text: string) => <span className="font-ui text-text-muted">{text}</span>;

const items: { label: string; value: (row: ProviderRow) => ReactNode; room: string }[] = [
    { label: "Running now", value: (row) => formatCount(row.active), room: "min-w-(--live-count)" },
    {
        label: "Sandboxes in 7 days",
        value: (row) => formatCount(row.sandboxes7d),
        room: "min-w-(--live-count)",
    },
    {
        label: "Median start",
        // Under 5 samples the feed sends no percentile
        value: (row) =>
            row.startP50Ms === null ? muted("Under 5 starts") : formatStartMs(row.startP50Ms),
        room: "min-w-(--live-words)",
    },
    {
        label: "Failed in 7 days",
        value: (row) => (row.failed7d === null ? muted("Unavailable") : formatCount(row.failed7d)),
        room: "min-w-(--live-words)",
    },
];

/**
 * The provider's live numbers, after its name, as no size has numbers of its own. Each keeps its
 * room while it loads, phones stack them, and a feed that is off covers them with one line, so data
 * arriving moves nothing.
 */
export function LiveNumbers({ name, live }: { name: string; live: Live }) {
    const off = live.kind === "unavailable";
    return (
        <div className="flex min-w-0 flex-1 items-baseline gap-(--space-5)">
            <p className="shrink-0 font-semibold text-text">{name}</p>
            <div className="relative min-w-0 flex-1">
                <dl
                    aria-hidden={off || undefined}
                    className={cx(
                        "flex flex-wrap gap-x-(--space-5) gap-y-(--space-1) phone:flex-col",
                        off && "invisible",
                    )}
                >
                    {items.map((item) => (
                        <div key={item.label} className="flex items-baseline gap-(--space-1)">
                            <dt className="text-text-muted">{item.label}:</dt>
                            {/* A space while there is no value keeps the line's baseline */}
                            <dd
                                className={cx(
                                    "h-(--fine-line) font-mono whitespace-nowrap",
                                    item.room,
                                )}
                            >
                                {live.kind === "row" ? item.value(live.row) : "\u00a0"}
                            </dd>
                        </div>
                    ))}
                </dl>
                {off && <p className="absolute inset-0 text-text-muted">{unavailable}</p>}
            </div>
        </div>
    );
}
