"use client";

import { lowestPrice, priceText } from "../../lib/landing/price";
import { useStats } from "../stats/stats-provider";

/** The cheapest run on sale, from the live feed; without the feed there is no price to show. */
export function FromPrice() {
    const { data } = useStats();
    const micros = data ? lowestPrice(data.packages) : null;
    if (micros === null) return null;
    return (
        <p className="text-(length:--ui-size) leading-(--ui-line) text-text-muted">
            From <span className="font-mono text-accent-2">{priceText(micros)}</span> USDC per run
        </p>
    );
}
