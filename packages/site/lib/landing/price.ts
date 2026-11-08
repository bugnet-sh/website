import { formatDuration, formatUsdc } from "../stats/format";
import { formatBytes } from "../stats/labels";
import type { PackageRow } from "../stats/types";

/** A price with as many decimals as it needs, at least two: 50 000 micros is "0.05". */
export function priceText(micros: number): string {
    return formatUsdc(micros, { decimals: 6 }).replace(/(\.\d\d\d*?)0+$/, "$1");
}

/** A package's rate per minute, rounded to the micro-USDC: 50 000 micros for 10 minutes is "0.005". */
export function perMinuteText(p: Pick<PackageRow, "priceMicros" | "minutes">): string {
    return priceText(Math.round(p.priceMicros / Math.max(1, p.minutes)));
}

const perMinute = (p: PackageRow) => p.priceMicros / Math.max(1, p.minutes);
const byRate = (a: PackageRow, b: PackageRow) => perMinute(a) - perMinute(b);

/**
 * The packages the landing shows, at most `max`: the CPU ones, then the GPU ones, each from the
 * lowest rate up. When both kinds have more than fit, each gets half, so GPUs are always shown.
 */
export function pricingPackages(rows: readonly PackageRow[], max = 8): PackageRow[] {
    const cpu = rows.filter((p) => !p.gpu).sort(byRate);
    const gpu = rows.filter((p) => p.gpu).sort(byRate);
    const cpuCount = Math.min(cpu.length, Math.max(max - gpu.length, Math.ceil(max / 2)));
    return [...cpu.slice(0, cpuCount), ...gpu.slice(0, max - cpuCount)];
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
