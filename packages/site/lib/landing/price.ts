import { formatDuration } from "../stats/format";
import { formatBytes } from "../stats/labels";
import type { PackageRow } from "../stats/types";

const perMinute = (p: PackageRow) => p.priceMicros / Math.max(1, p.minutes);
export const byRate = (a: PackageRow, b: PackageRow) => perMinute(a) - perMinute(b);

/** Popular GPUs not on sale yet (founder, 2026-11-08): each card names the GPU and its VRAM, no price */
export const SOON_GPUS: readonly { model: string; memoryGiB: number }[] = [
    { model: "NVIDIA H100", memoryGiB: 80 },
    { model: "NVIDIA A100", memoryGiB: 80 },
    { model: "NVIDIA L40S", memoryGiB: 48 },
    { model: "NVIDIA L4", memoryGiB: 24 },
];

export type PricingCell =
    { kind: "package"; p: PackageRow } | { kind: "soon"; model: string; memoryGiB: number };

/**
 * The landing's pricing cells, `max` in all: up to `maxCpu` CPU packages, then the GPU packages on
 * sale, then popular GPUs marked coming soon to fill the rest, each kind from the lowest rate up.
 * At least two places are GPUs, and a GPU on sale is never also shown as coming soon.
 */
export function pricingCells(rows: readonly PackageRow[], max = 8, maxCpu = 6): PricingCell[] {
    const cpu = rows
        .filter((p) => !p.gpu)
        .sort(byRate)
        .slice(0, Math.min(maxCpu, max - 2));
    const gpu = rows.filter((p) => p.gpu).sort(byRate);
    const sold = new Set(gpu.map((p) => p.gpu?.model?.toLowerCase()));
    const soon = SOON_GPUS.filter((g) => !sold.has(g.model.toLowerCase()));
    return [
        ...cpu.map((p) => ({ kind: "package" as const, p })),
        ...[
            ...gpu.map((p) => ({ kind: "package" as const, p })),
            ...soon.map((g) => ({ kind: "soon" as const, ...g })),
        ].slice(0, max - cpu.length),
    ];
}

const MiB = 1024 ** 2;
const GiB = 1024 ** 3;
const gpuCount = (count: number) => `${count} ${count === 1 ? "GPU" : "GPUs"}`;

/** What a package's price buys: "/ 10 min" (founder, 2026-11-08: "Pricing becomes / 10 minute") */
export function lengthText(p: Pick<PackageRow, "minutes">): string {
    return `/ ${formatDuration(p.minutes * 60)}`;
}

/**
 * What a package holds, as its pricing cell lists it: a GPU's model and VRAM first, when it has
 * one. Its length is in its price's line. A GPU the feed names no model for shows its count, as
 * "1 GPU".
 */
export function packageFacts(p: PackageRow): { label: string; value: string }[] {
    const gpu = p.gpu;
    const times = gpu && gpu.count > 1 ? `${gpu.count} × ` : "";
    return [
        ...(gpu
            ? [
                  { label: "GPU", value: gpu.model ? `${times}${gpu.model}` : gpuCount(gpu.count) },
                  { label: "VRAM", value: `${times}${gpu.memoryGiB} GiB` },
              ]
            : []),
        { label: "vCPU", value: String(p.vcpu) },
        { label: "Memory", value: formatBytes(p.memoryMiB * MiB) },
        { label: "Disk", value: formatBytes(p.diskGiB * GiB) },
    ];
}
