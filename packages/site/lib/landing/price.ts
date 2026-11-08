import { formatDuration, formatUsdc } from "../stats/format";
import { formatBytes } from "../stats/labels";
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

const MiB = 1024 ** 2;
const GiB = 1024 ** 3;

/** What a package holds, as its pricing cell lists it; the GPU row only when it has one. */
export function packageFacts(p: PackageRow): { label: string; value: string }[] {
    return [
        { label: "vCPU", value: String(p.vcpu) },
        { label: "Memory", value: formatBytes(p.memoryMiB * MiB) },
        { label: "Disk", value: formatBytes(p.diskGiB * GiB) },
        ...(p.gpu ? [{ label: "GPU", value: `${p.gpu.count} × ${p.gpu.memoryGiB} GiB` }] : []),
        { label: "Length", value: formatDuration(p.minutes * 60) },
    ];
}
