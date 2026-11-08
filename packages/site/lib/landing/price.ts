import { formatUsdc } from "../stats/format";
import type { PackageRow } from "../stats/types";

/** The cheapest package's price in micro-USDC, or null when nothing is on sale. */
export function lowestPrice(packages: readonly PackageRow[]): number | null {
    if (packages.length === 0) return null;
    return Math.min(...packages.map((p) => p.priceMicros));
}

/** A price with as many decimals as it needs, at least two: 50 000 micros is "0.05". */
export function priceText(micros: number): string {
    return formatUsdc(micros, { decimals: 6 }).replace(/(\.\d\d\d*?)0+$/, "$1");
}
