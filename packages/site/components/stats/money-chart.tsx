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
    usePlotArea,
    useYAxisScale,
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
import { dayTick, moneyTick, niceScale, sharedAxisWidth, type Scale } from "./axis";
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

/** The y range widened to whole steps, and its ticks; zero is always a tick. */
export const scaleOf = (points: readonly Point[]): Scale =>
    niceScale(points.flatMap((p) => [p.earned, p.spent, p.profit]));

/** A label's line box (--fine-line), the least gap between two labels' baselines. */
const LABEL_LINE = 16;
const ABOVE = -8;
const BELOW = 16;

/**
 * Baseline offsets for the two end labels, given each line's last y and the plot's bottom. Apart,
 * each sits above its own point. Closer than a label's line box, the lower line's label goes
 * under its point, or, with no room left under it, the upper one rises clear of it.
 */
export function endOffsets(
    earnedY: number,
    spentY: number,
    bottom: number,
): { earned: number; spent: number } {
    if (Math.abs(earnedY - spentY) >= LABEL_LINE) return { earned: ABOVE, spent: ABOVE };
    const earnedUpper = earnedY <= spentY;
    const [upperY, lowerY] = earnedUpper ? [earnedY, spentY] : [spentY, earnedY];
    const [upper, lower] =
        lowerY + BELOW <= bottom ? [ABOVE, BELOW] : [lowerY + ABOVE - LABEL_LINE - upperY, ABOVE];
    return earnedUpper ? { earned: upper, spent: lower } : { earned: lower, spent: upper };
}

type Series = "earned" | "spent";

/** The value at a line's last point, in its line's colour, so a reader need not trace it back. */
function EndLabelText({
    x,
    y,
    value,
    series,
    final,
}: {
    x: number;
    y: number;
    value: number;
    series: Series;
    final: Point;
}) {
    const plot = usePlotArea();
    const scale = useYAxisScale();
    const dy =
        plot && scale
            ? endOffsets(scale(final.earned) ?? 0, scale(final.spent) ?? 0, plot.y + plot.height)[
                  series
              ]
            : ABOVE;
    return (
        <text
            x={x}
            y={y}
            dx={-4}
            dy={dy}
            textAnchor="end"
            fill={series === "earned" ? "var(--accent-2)" : "var(--text-muted)"}
            stroke="var(--bg)"
            strokeWidth={4}
            paintOrder="stroke"
        >
            {formatUsdc(micros(value))}
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
    const scale = scaleOf(points);
    const last = points.length - 1;
    const end = points[last];
    const endLabel = (series: Series) =>
        function SeriesEndLabel({ x, y, value, index }: LabelProps & { index?: number }) {
            if (index !== last || end === undefined) return null;
            if (typeof x !== "number" || typeof y !== "number") return null;
            return <EndLabelText x={x} y={y} value={Number(value)} series={series} final={end} />;
        };
    const width = stats.data ? sharedAxisWidth(rangeDays(stats.data.daily, stats.range)) : 0;
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
                                    tick={dayTick(points[0]?.day, end?.day)}
                                    tickLine={false}
                                    axisLine={{ stroke: "var(--line)" }}
                                    minTickGap={24}
                                />
                                <YAxis
                                    domain={scale.domain}
                                    ticks={scale.ticks}
                                    width={width}
                                    tickFormatter={(value: number) =>
                                        moneyTick(value, scale.decimals)
                                    }
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <ChartTooltip
                                    cursor={{ stroke: "var(--text-muted)", strokeWidth: 1 }}
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
                                    <LabelList dataKey="spent" content={endLabel("spent")} />
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
                                    <LabelList dataKey="earned" content={endLabel("earned")} />
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
