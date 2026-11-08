"use client";

import { formatUsdc } from "../../lib/stats/format";
import { kindLabels, knownMethods, methodLabel, share } from "../../lib/stats/labels";
import { formatCount } from "../../lib/stats/view";
import { Usdc } from "./cells";
import { Facts, Panel, SectionTitle } from "./panels";
import { useStats } from "./stats-provider";
import { isUnavailable, Unavailable } from "./unavailable";

/** A line with no numbers yet is a row kept for the feed, so its arrival moves nothing. */
type Line = { label: string; count: number | null; micros: number | null };

/** A share under this is drawn as no bar at all, never as a one-pixel tick. */
const LEAST_SHARE = 0.01;

/**
 * One list on a shared grid, so counts and amounts line up down the rows. Each row's bar is its
 * share of the list's USDC.
 */
function ShareList({ title, lines, decimals }: { title: string; lines: Line[]; decimals: number }) {
    const total = lines.reduce((sum, l) => sum + (l.micros ?? 0), 0);
    const head = "text-(length:--fine-size) leading-(--fine-line) font-semibold text-text-muted";
    return (
        <ul className="mt-(--space-5) grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-(--space-4)">
            <li className="col-span-3 grid grid-cols-subgrid border-b-(length:--hairline) border-line pb-(--space-2)">
                <span className={head}>{title}</span>
                <span className={`${head} text-right`}>Count</span>
                <span className={`${head} text-right`}>USDC</span>
            </li>
            {lines.map((line) => {
                const part = line.micros === null ? 0 : share(line.micros, total);
                return (
                    <li
                        key={line.label}
                        className="col-span-3 grid grid-cols-subgrid items-baseline border-b-(length:--hairline) border-line py-(--space-2) text-(length:--ui-size) leading-(--ui-line)"
                    >
                        <span className="truncate">{line.label}</span>
                        <span className="text-right font-mono">
                            {line.count !== null && formatCount(line.count)}
                        </span>
                        <span className="text-right font-mono text-accent-2">
                            {line.micros !== null && formatUsdc(line.micros, { decimals })}
                        </span>
                        {/* A fixed line box, so a row keeps its height with no bar in it */}
                        <span aria-hidden className="col-span-3 mt-(--space-2) h-(--share-line)">
                            {part >= LEAST_SHARE && (
                                <span
                                    className="block h-full bg-text-muted/40"
                                    style={{ width: `${part * 100}%` }}
                                />
                            )}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

const waitingKinds: Line[] = Object.values(kindLabels).map((label) => ({
    label,
    count: null,
    micros: null,
}));

const waitingMethods: Line[] = knownMethods.map((method) => ({
    label: methodLabel(method),
    count: null,
    micros: null,
}));

/** Band 4, right: all-time payments by what they bought and how they were paid. */
export function PaymentsBreakdown() {
    const stats = useStats();
    const { data } = stats;
    const kinds = data
        ? data.payments.byKind.map((k) => ({ ...k, label: kindLabels[k.kind] }))
        : waitingKinds;
    const methods = data
        ? data.payments.byMethod.map((m) => ({ ...m, label: methodLabel(m.method) }))
        : waitingMethods;
    // One precision for every amount in both lists, so their decimal points line up: three when
    // any is under 1 USDC, as the tables write such amounts
    const small = [...kinds, ...methods].some(
        (l) => l.micros !== null && Math.abs(l.micros) < 1_000_000,
    );
    const decimals = small ? 3 : 2;
    return (
        <Panel second>
            <SectionTitle>Payment breakdown</SectionTitle>
            <ShareList title="By kind" lines={kinds} decimals={decimals} />
            {methods.length > 0 && (
                <ShareList title="By method" lines={methods} decimals={decimals} />
            )}
            <div className="mt-(--space-5)">
                <Facts
                    items={[
                        {
                            label: "Refunds",
                            value: data && (
                                <>
                                    <span className="font-ui text-text-muted">
                                        {formatCount(data.payments.refunds.count)}{" "}
                                        {data.payments.refunds.count === 1 ? "refund" : "refunds"}
                                    </span>
                                    <Usdc micros={data.payments.refunds.micros} />
                                </>
                            ),
                        },
                        {
                            label: "Allowance returned",
                            value: data && <Usdc micros={data.totals.allowanceReturnedMicros} />,
                        },
                        {
                            label: "x402 spent",
                            value: data && <Usdc micros={data.totals.x402SpentMicros} />,
                        },
                    ]}
                />
            </div>
            {isUnavailable(stats) && <Unavailable />}
        </Panel>
    );
}
