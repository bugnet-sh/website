"use client";

import { formatUsdc } from "../../lib/stats/format";
import { useStats } from "../stats/stats-provider";
import { isUnavailable } from "../stats/unavailable";
import { Skeleton } from "../ui/skeleton";

const usd = (micros: number) => `${formatUsdc(micros)}\u00a0USDC`;
const heads = ["vCPU", "Memory", "Disk", "Time", "Price"];
const widths = ["w-[12%]", "w-[18%]", "w-[18%]", "w-[18%]", "w-[34%]"];
/** Each column's bar is about as wide as its usual value: "8", "16 GiB", "0.30 USDC" */
const bars = ["w-[1ch]", "w-[6ch]", "w-[7ch]", "w-[6ch]", "w-[9ch]"];
const row = "border-b-(length:--hairline) border-line text-[max(14px,1.45cqi)] tabular-nums";
const cell = "py-[1.15cqi]";

/**
 * The packages on sale, from the live feed only (founder D13, 2026-11-13): skeleton rows pulse
 * until it answers, and one row says so once it is off.
 */
export function Prices() {
    const stats = useStats();
    const off = isUnavailable(stats);
    const packages = stats.data?.packages ?? [];
    return (
        <table className="w-full table-fixed border-collapse text-left">
            {/* Set widths, so the columns are the same while the prices load and once they arrive */}
            <colgroup>
                {widths.map((w, j) => (
                    <col key={heads[j]} className={w} />
                ))}
            </colgroup>
            <thead>
                <tr className="border-b-(length:--hairline) border-line text-[max(12px,1.15cqi)] text-text-muted">
                    {heads.map((h) => (
                        <th key={h} scope="col" className="pb-[1.2cqi] font-normal">
                            {h}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody aria-busy={!stats.data || undefined}>
                {stats.data &&
                    packages.map((p) => (
                        <tr key={p.id} className={row}>
                            <td className={cell}>{p.vcpu}</td>
                            <td className={cell}>{p.memoryMiB / 1024}&nbsp;GiB</td>
                            <td className={cell}>{p.diskGiB}&nbsp;GiB</td>
                            <td className={cell}>{p.minutes}&nbsp;min</td>
                            <td className={`${cell} text-accent`}>{usd(p.priceMicros)}</td>
                        </tr>
                    ))}
                {!stats.data && off && (
                    <tr className={row}>
                        <td colSpan={heads.length} className={`${cell} text-text-muted`}>
                            Stats are unavailable right now.
                        </td>
                    </tr>
                )}
                {!stats.data &&
                    !off &&
                    [0, 1, 2, 3].map((i) => (
                        <tr key={i} className={row} aria-hidden="true">
                            {heads.map((h, j) => (
                                <td key={h} className={cell}>
                                    <Skeleton className={`h-[1lh] py-[0.25lh] ${bars[j]}`} />
                                </td>
                            ))}
                        </tr>
                    ))}
            </tbody>
        </table>
    );
}
