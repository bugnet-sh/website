"use client";

import {
    Bar,
    CartesianGrid,
    ComposedChart,
    LabelList,
    Line,
    Rectangle,
    XAxis,
    YAxis,
    type BarShapeProps,
    type LabelProps,
} from "recharts";
import { formatUsdc, profit } from "../../lib/stats/format";
import type { DayRow } from "../../lib/stats/types";
import { formatDay, rangeDays, signedUsdc } from "../../lib/stats/view";
import { Band, Frame } from "../shell/frame";
import {
    ChartContainer,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "../ui/chart";
import { Tip } from "../ui/tip";
import { RangeControl } from "./range";
import { useStats } from "./stats-provider";
import { isUnavailable, Unavailable } from "./unavailable";

const config = {
    earned: { label: "Earned", color: "var(--accent-2)", marker: "line" },
    spent: { label: "Spent on providers", color: "var(--text-muted)", marker: "dashed" },
    profit: { label: "Profit", color: "var(--chart-profit)", marker: "square" },
} satisfies ChartConfig;

const explained =
    "Earned is what users paid for sandboxes, extensions and x402 fees. x402 allowance money " +
    "passes through at cost and is not earned. Spent is what providers charge us, without " +
    "Solana network fees. Profit is earned minus refunds minus spent.";

type Point = { day: string; earned: number; spent: number; profit: number };

const usdc = (micros: number) => micros / 1_000_000;
const micros = (usdc: number) => Math.round(usdc * 1_000_000);

export function toPoints(daily: readonly DayRow[]): Point[] {
    return daily.map((d) => ({
        day: d.day,
        earned: usdc(d.earnedMicros),
        spent: usdc(d.spentMicros),
        profit: usdc(profit(d)),
    }));
}

/**
 * Zero is always on the axis, so a bar grows from it. All-zero days still get a span, so a new
 * deployment's axis reads 0 to 1 rather than one value repeated.
 */
export function domainOf(points: readonly Point[]): [number, number] {
    const values = points.flatMap((p) => [p.earned, p.spent, p.profit]);
    const low = Math.min(0, ...values);
    const high = Math.max(0, ...values);
    return low === high ? [0, 1] : [low, high];
}

const tick = (value: number) =>
    formatUsdc(micros(value), { decimals: Number.isInteger(value) ? 0 : 2 });

/** The value at a line's last point, so a reader need not trace it back to the axis. */
function EndLabel({ x, y, value, index, last }: LabelProps & { index?: number; last: number }) {
    if (index !== last || typeof x !== "number" || typeof y !== "number") return null;
    return (
        <text x={x} y={y} dx={-4} dy={-8} textAnchor="end" fill="var(--text)">
            {formatUsdc(micros(Number(value)))}
        </text>
    );
}

// Drawn under each line in the page colour, so a line stays legible where it crosses a bar
function halo(key: "earned" | "spent") {
    return (
        <Line
            dataKey={key}
            type="monotone"
            stroke="var(--bg)"
            strokeWidth={6}
            dot={false}
            activeDot={false}
            legendType="none"
            tooltipType="none"
            isAnimationActive={false}
        />
    );
}

function ProfitBar(props: BarShapeProps) {
    const value = (props.payload as Point | undefined)?.profit ?? 0;
    return <Rectangle {...props} fill={value < 0 ? "var(--chart-loss)" : "var(--color-profit)"} />;
}

/** Earned and spent as lines, profit as bars, over the chosen range of UTC days. */
export function MoneyChart() {
    const stats = useStats();
    const points = stats.data ? toPoints(rangeDays(stats.data.daily, stats.range)) : [];
    const last = points.length - 1;
    const endLabel = (props: LabelProps) => <EndLabel {...props} last={last} />;
    return (
        <Band rail={false}>
            <Frame className="py-(--space-6)">
                <div className="relative flex items-center gap-(--space-2)">
                    <h2 className="text-(length:--ui-size) leading-(--ui-line) font-semibold">
                        Money over time
                    </h2>
                    <Tip text={explained} label="About these numbers" />
                </div>
                <div className="mt-(--space-4) flex flex-wrap items-center justify-between gap-(--space-3)">
                    <ChartLegendContent config={config} />
                    <RangeControl value={stats.range} onChange={stats.setRange} />
                </div>
                <div className="relative mt-(--space-4) h-(--chart) phone:h-(--chart-phone)">
                    {points.length > 0 && (
                        <ChartContainer config={config} className="h-full w-full">
                            <ComposedChart
                                data={points}
                                barCategoryGap={1}
                                margin={{ top: 16, right: 0, bottom: 0, left: 0 }}
                            >
                                <CartesianGrid vertical={false} stroke="var(--line)" />
                                <XAxis
                                    dataKey="day"
                                    tickFormatter={formatDay}
                                    tickLine={false}
                                    axisLine={{ stroke: "var(--line)" }}
                                    minTickGap={24}
                                />
                                <YAxis
                                    domain={domainOf(points)}
                                    width="auto"
                                    tickFormatter={tick}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <ChartTooltip
                                    cursor={{ fill: "var(--surface-hover)" }}
                                    isAnimationActive={false}
                                    content={
                                        <ChartTooltipContent
                                            labelFormatter={formatDay}
                                            valueFormatter={(value, key) => {
                                                const amount = micros(value);
                                                if (key !== "profit") return formatUsdc(amount);
                                                const { text, negative } = signedUsdc(amount);
                                                return (
                                                    <span
                                                        className={
                                                            negative ? "text-bad" : undefined
                                                        }
                                                    >
                                                        {text}
                                                    </span>
                                                );
                                            }}
                                        />
                                    }
                                />
                                <Bar
                                    dataKey="profit"
                                    fill="var(--color-profit)"
                                    shape={ProfitBar}
                                    isAnimationActive={false}
                                />
                                {halo("spent")}
                                <Line
                                    dataKey="spent"
                                    type="monotone"
                                    stroke="var(--color-spent)"
                                    strokeWidth={2}
                                    strokeDasharray="6 4"
                                    dot={false}
                                    isAnimationActive={false}
                                >
                                    <LabelList dataKey="spent" content={endLabel} />
                                </Line>
                                {halo("earned")}
                                <Line
                                    dataKey="earned"
                                    type="monotone"
                                    stroke="var(--color-earned)"
                                    strokeWidth={2}
                                    dot={false}
                                    isAnimationActive={false}
                                >
                                    <LabelList dataKey="earned" content={endLabel} />
                                </Line>
                            </ComposedChart>
                        </ChartContainer>
                    )}
                    {isUnavailable(stats) && <Unavailable />}
                </div>
            </Frame>
        </Band>
    );
}
