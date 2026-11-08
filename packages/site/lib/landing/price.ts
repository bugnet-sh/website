import { formatDuration, formatUsdc } from "../stats/format";
import { formatBytes } from "../stats/labels";
import type { PackageRow } from "../stats/types";

/** A price with as many decimals as it needs, at least two: 50 000 micros is "0.05". */
export function priceText(micros: number): string {
    return formatUsdc(micros, { decimals: 6 }).replace(/(\.\d\d\d*?)0+$/, "$1");
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

/** What a package's price buys: "/ 10 min" */
export function lengthText(p: Pick<PackageRow, "minutes">): string {
    return `/ ${formatDuration(p.minutes * 60)}`;
}

/** What a package holds, as its pricing cell lists it: a GPU's model and VRAM first, when it has one. */
export function packageFacts(p: PackageRow): { label: string; value: string }[] {
    const gpu = p.gpu;
    const times = gpu && gpu.count > 1 ? `${gpu.count} × ` : "";
    return [
        ...(gpu
            ? [
                  { label: "GPU", value: gpu.model ? `${times}${gpu.model}` : String(gpu.count) },
                  { label: "VRAM", value: `${times}${gpu.memoryGiB} GiB` },
              ]
            : []),
        { label: "vCPU", value: String(p.vcpu) },
        { label: "Memory", value: formatBytes(p.memoryMiB * MiB) },
        { label: "Disk", value: formatBytes(p.diskGiB * GiB) },
    ];
}
