"use client";

import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { formatUsdc, profit } from "../../lib/stats/format";
import type { StatsSummary } from "../../lib/stats/types";
import { formatCount, formatHours, signedUsdc } from "../../lib/stats/view";
import { Band, Frame } from "../shell/frame";
import { useStats } from "./stats-provider";
import { isUnavailable, Unavailable } from "./unavailable";

type Cell = { label: string; value: (s: StatsSummary) => ReactNode };

function Money({ micros, signed = false }: { micros: number; signed?: boolean }) {
    const { text, negative } = signed
        ? signedUsdc(micros)
        : { text: formatUsdc(micros), negative: false };
    return (
        <>
            <span className={negative ? "text-bad" : "text-accent-2"}>{text}</span>
            <span className="ml-(--space-2) font-ui text-(length:--ui-size) text-text-muted phone:ml-(--space-1) phone:text-(length:--fine-size)">
                USDC
            </span>
        </>
    );
}

const cells: Cell[] = [
    { label: "Active now", value: (s) => formatCount(s.now.active) },
    { label: "Sandboxes run", value: (s) => formatCount(s.totals.sandboxes) },
    { label: "Compute hours sold", value: (s) => formatHours(s.totals.computeSeconds) },
    { label: "Earned", value: (s) => <Money micros={s.totals.earnedMicros} /> },
    { label: "Spent on providers", value: (s) => <Money micros={s.totals.spentMicros} /> },
    { label: "Profit", value: (s) => <Money micros={profit(s.totals)} signed /> },
];

/**
 * The first column's cells pad to the frame's edge, so their text lines up with every band's;
 * the others pad by one gap. Each breakpoint has its own first column.
 */
function inset(i: number): string {
    return cx(
        i % 6 === 0 ? "px-(--pad)" : "px-(--space-5)",
        i % 3 === 0 ? "narrow:px-(--pad)" : "narrow:px-(--space-5)",
        i % 2 === 0 ? "phone:px-(--pad)" : "phone:px-(--space-5)",
    );
}

/** Six totals in a hairline grid: the lines are the grid's background showing through its gaps. */
export function Headline() {
    const stats = useStats();
    const { data } = stats;
    return (
        <Band rail={false}>
            <Frame padded={false} className="relative">
                <dl className="grid grid-cols-6 gap-(--hairline) bg-line narrow:grid-cols-3 phone:grid-cols-2">
                    {cells.map((cell, i) => (
                        <div key={cell.label} className={cx("bg-bg py-(--space-5)", inset(i))}>
                            <dt className="text-(length:--fine-size) leading-(--fine-line) text-text-muted">
                                {cell.label}
                            </dt>
                            {/* A fixed line box, so a value arriving or changing moves nothing */}
                            <dd className="mt-(--space-2) h-(--stat-line) truncate font-head text-(length:--stat-size) leading-(--stat-line) font-extralight tabular-nums">
                                {data && cell.value(data)}
                            </dd>
                        </div>
                    ))}
                </dl>
                {isUnavailable(stats) && <Unavailable />}
            </Frame>
        </Band>
    );
}
