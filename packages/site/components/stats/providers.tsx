"use client";

import { useId, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import {
    failureRate,
    formatShare,
    formatStartMs,
    providerLabel,
    share,
} from "../../lib/stats/labels";
import type { ProviderRow } from "../../lib/stats/types";
import { formatCount } from "../../lib/stats/view";
import { Band } from "../shell/frame";
import { Tip } from "../ui/tip";
import { bodyCell, Cut, headCell, tableClass } from "./cells";
import { SectionTitle } from "./panels";
import { useStats } from "./stats-provider";
import { isUnavailable, Unavailable } from "./unavailable";

/** Under 5 samples the feed sends no percentile, as shared health needs 5. */
function Start({ ms }: { ms: number | null }) {
    if (ms === null) return <span className="font-ui text-text-muted">Under 5 starts</span>;
    return formatStartMs(ms);
}

function Share({ part, total }: { part: number; total: number }) {
    return (
        <span className="flex items-center gap-(--space-2)">
            <span aria-hidden className="flex w-(--share-bar)">
                <span
                    className="h-(--share-line) bg-text-muted/40"
                    style={{ width: `${share(part, total) * 100}%` }}
                />
            </span>
            <span className="font-mono">{formatShare(part, total)}</span>
        </span>
    );
}

const columns: {
    label: string;
    numeric?: boolean;
    cell: (p: ProviderRow, total: number) => ReactNode;
}[] = [
    { label: "Provider", cell: (p) => <Cut>{providerLabel(p.provider)}</Cut> },
    {
        label: "Share of sandboxes",
        cell: (p, total) => <Share part={p.sandboxes7d} total={total} />,
    },
    { label: "Active now", numeric: true, cell: (p) => formatCount(p.active) },
    { label: "Start (median)", numeric: true, cell: (p) => <Start ms={p.startP50Ms} /> },
    { label: "Start (slowest 5 %)", numeric: true, cell: (p) => <Start ms={p.startP95Ms} /> },
    { label: "Failure rate", numeric: true, cell: (p) => failureRate(p) },
];

/** Band 5: how each provider has done over the last 7 days. */
export function Providers() {
    const stats = useStats();
    const id = useId();
    const rows = stats.data?.providers ?? [];
    const total = rows.reduce((sum, p) => sum + p.sandboxes7d, 0);
    return (
        <Band>
            <div className="relative min-h-(--box) py-(--space-6)">
                <div className="relative flex items-center gap-(--space-2)">
                    <SectionTitle id={id}>Providers</SectionTitle>
                    <Tip text="The last 7 days." label="About this table" />
                </div>
                {stats.data && rows.length === 0 && (
                    <p className="mt-(--space-4) text-(length:--ui-size) leading-(--ui-line) text-text-muted">
                        No sandboxes in the last 7 days.
                    </p>
                )}
                {rows.length > 0 && (
                    <div className="relative mt-(--space-4) overflow-x-auto">
                        <table
                            aria-labelledby={id}
                            className={cx(tableClass, "min-w-(--table-min)")}
                        >
                            <thead>
                                <tr>
                                    {columns.map((c) => (
                                        <th
                                            key={c.label}
                                            scope="col"
                                            className={headCell(c.numeric)}
                                        >
                                            {c.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((p, i) => (
                                    // Names are the feed's and may repeat, so the order keys a row
                                    <tr key={i}>
                                        {columns.map((c) => (
                                            <td key={c.label} className={bodyCell(c.numeric)}>
                                                {c.cell(p, total)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {isUnavailable(stats) && <Unavailable />}
            </div>
        </Band>
    );
}
