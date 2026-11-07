"use client";

import { formatUsdc } from "../../lib/stats/format";
import { kindLabels, methodLabel, share } from "../../lib/stats/labels";
import { formatCount } from "../../lib/stats/view";
import { Usdc } from "./cells";
import { Facts, Panel, SectionTitle } from "./panels";
import { useStats } from "./stats-provider";
import { isUnavailable, Unavailable } from "./unavailable";

type Line = { label: string; count: number; micros: number };

/**
 * One list on a shared grid, so counts and amounts line up down the rows. Each row's bar is its
 * share of the list's USDC.
 */
function ShareList({ title, lines }: { title: string; lines: Line[] }) {
    const total = lines.reduce((sum, l) => sum + l.micros, 0);
    const head = "text-(length:--fine-size) leading-(--fine-line) font-semibold text-text-muted";
    return (
        <ul className="mt-(--space-5) grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-(--space-4)">
            <li className="col-span-3 grid grid-cols-subgrid border-b-(length:--hairline) border-line pb-(--space-2)">
                <span className={head}>{title}</span>
                <span className={`${head} text-right`}>Count</span>
                <span className={`${head} text-right`}>USDC</span>
            </li>
            {lines.map((line) => (
                <li
                    key={line.label}
                    className="col-span-3 grid grid-cols-subgrid items-baseline border-b-(length:--hairline) border-line py-(--space-2) text-(length:--ui-size) leading-(--ui-line)"
                >
                    <span className="truncate">{line.label}</span>
                    <span className="text-right font-mono">{formatCount(line.count)}</span>
                    <span className="text-right font-mono text-accent-2">
                        {formatUsdc(line.micros)}
                    </span>
                    <span
                        aria-hidden
                        className="col-span-3 mt-(--space-2) h-(--share-line) bg-text-muted/40"
                        style={{ width: `${share(line.micros, total) * 100}%` }}
                    />
                </li>
            ))}
        </ul>
    );
}

/** Band 4, right: all-time payments by what they bought and how they were paid. */
export function PaymentsBreakdown() {
    const stats = useStats();
    const { data } = stats;
    return (
        <Panel>
            <SectionTitle>Payment breakdown</SectionTitle>
            {data && (
                <>
                    <ShareList
                        title="By kind"
                        lines={data.payments.byKind.map((k) => ({
                            ...k,
                            label: kindLabels[k.kind],
                        }))}
                    />
                    {data.payments.byMethod.length > 0 && (
                        <ShareList
                            title="By method"
                            lines={data.payments.byMethod.map((m) => ({
                                ...m,
                                label: methodLabel(m.method),
                            }))}
                        />
                    )}
                    <div className="mt-(--space-5)">
                        <Facts
                            items={[
                                {
                                    label: "Refunds",
                                    value: (
                                        <>
                                            <span>{formatCount(data.payments.refunds.count)}</span>
                                            <Usdc micros={data.payments.refunds.micros} />
                                        </>
                                    ),
                                },
                                {
                                    label: "Allowance returned",
                                    value: <Usdc micros={data.totals.allowanceReturnedMicros} />,
                                },
                                {
                                    label: "x402 spent",
                                    value: <Usdc micros={data.totals.x402SpentMicros} />,
                                },
                            ]}
                        />
                    </div>
                </>
            )}
            {isUnavailable(stats) && <Unavailable />}
        </Panel>
    );
}
