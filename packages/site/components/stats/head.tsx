"use client";

import { cx } from "../../lib/cx";
import { formatClock, isStale } from "../../lib/stats/view";
import { Band, Frame } from "../shell/frame";
import { useStats } from "./stats-provider";

/** The page's title band, with when the numbers below were made. */
export function StatsHead() {
    const stats = useStats();
    const stale = isStale(stats);
    return (
        <Band as="header" rail={false}>
            <Frame className="pt-(--band) pb-(--space-6)">
                <h1 className="font-head text-(length:--title-size) leading-(--title-line) font-extralight">
                    Stats
                </h1>
                <div className="mt-(--space-3) flex flex-wrap items-baseline justify-between gap-x-(--space-5) gap-y-(--space-2)">
                    <p className="text-(length:--lead-size) leading-(--lead-line) text-text-muted">
                        Live numbers from Bugnet. Nothing here is estimated unless it says so.
                    </p>
                    {/* Kept in the row while empty, so the time arriving moves nothing */}
                    <p className="flex min-h-(--lead-line) items-center gap-(--space-2) text-(length:--ui-size) leading-(--ui-line) tabular-nums">
                        {stats.data && (
                            <>
                                <span className="text-text-muted">Updated</span>
                                <time dateTime={stats.data.generatedAt}>
                                    {formatClock(stats.data.generatedAt)}
                                </time>
                            </>
                        )}
                        {(stats.data || stale) && (
                            <span
                                className={cx(
                                    "size-(--dot) shrink-0 rounded-full",
                                    stale ? "bg-warn" : "bg-text",
                                )}
                                {...(stale
                                    ? { role: "img", "aria-label": "Data may be out of date" }
                                    : { "aria-hidden": true })}
                            />
                        )}
                    </p>
                </div>
            </Frame>
        </Band>
    );
}
