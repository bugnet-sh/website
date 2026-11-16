"use client";

import { cx } from "../../lib/cx";
import { formatUsdc } from "../../lib/stats/format";
import { useStats } from "./stats-provider";
import { isUnavailable } from "./unavailable";

/**
 * A package's live price, as "0.003355", for copy that quotes it in a sentence. Until the feed
 * answers it is a bar as wide as such a price, which stands still once the feed is off (founder
 * D13, 2026-11-13).
 */
export function LivePrice({ id }: { id: string }) {
    const stats = useStats();
    const p = stats.data?.packages.find((x) => x.id === id);
    if (p) return <>{formatUsdc(p.priceMicros)}</>;
    return (
        <span
            aria-label="Price loading"
            className={cx(
                "inline-block h-[1em] w-[8ch] bg-line align-[-0.15em]",
                !isUnavailable(stats) && "animate-pulse motion-reduce:animate-none",
            )}
        />
    );
}
