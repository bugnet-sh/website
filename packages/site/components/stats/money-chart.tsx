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
import { alignedDecimals, formatUsdc, profit } from "../../lib/stats/format";
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
import { axisWidth, dayTick, moneyTick, niceScale, sharedAxisWidth, type Scale } from "./axis";
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

/** Spent and profit are null while the feed does not know our provider cost yet */
type Point = { day: string; earned: number; spent: number | null; profit: number | null };

const usdc = (micros: number) => micros / 1_000_000;
const micros = (usdc: number) => Math.round(usdc * 1_000_000);

export function toPoints(daily: readonly DayRow[]): Point[] {
    return daily.map((d) => {
        const p = profit(d);
        return {
            day: d.day,
            earned: usdc(d.earnedMicros),
            spent: d.spentMicros === null ? null : usdc(d.spentMicros),
            profit: p === null ? null : usdc(p),
        };
    });
}

/**
 * A day's amount in the tooltip, to the precision of the longest of that day's amounts, so their
 * decimal points line up. Only profit can be a loss.
 */
export function tooltipMoney(
    value: number,
    key: string,
    values: readonly number[],
): { text: string; negative: boolean } {
    const amount = micros(value);
    const decimals = alignedDecimals(values.map(micros));
    return key === "profit"
        ? signedUsdc(amount, decimals)
        : { text: formatUsdc(amount, { decimals }), negative: false };
}

/** The y range widened to whole steps, and its ticks; zero is always a tick. */
export const scaleOf = (points: readonly Point[]): Scale =>
    niceScale(points.flatMap((p) => [p.earned, p.spent, p.profit].filter((v) => v !== null)));

/** A label's line box (--fine-line), the least gap between two labels' centres. */
const LABEL_LINE = 16;

/**
 * Where the two end labels centre, given each line's last y and the plot's top and bottom. Apart,
 * each sits level with its own point. Closer than a label's line box, they part evenly round the
 * middle of the two, and both move inside the plot if that pushes one past an edge.
 */
export function endPlaces(
    earnedY: number,
    spentY: number,
    top: number,
    bottom: number,
): { earned: number; spent: number } {
    const half = LABEL_LINE / 2;
    const inside = (y: number) => Math.min(bottom - half, Math.max(top + half, y));
    const [earned, spent] = [inside(earnedY), inside(spentY)];
    if (Math.abs(earned - spent) >= LABEL_LINE) return { earned, spent };
    const middle = (earned + spent) / 2;
    const upper = Math.min(Math.max(middle - half, top + half), bottom - LABEL_LINE - half);
    return earnedY <= spentY
        ? { earned: upper, spent: upper + LABEL_LINE }
        : { earned: upper + LABEL_LINE, spent: upper };
}

type Series = "earned" | "spent";

/**
 * The value at a line's last point, in its line's colour, so a reader need not trace it back. It
 * sits in a gutter right of the plot, level with its point and ending on the frame's edge, so it
 * never covers a line or a bar.
 */
function EndLabelText({
    y,
    value,
    series,
    final,
    gutter,
}: {
    y: number;
    value: number;
    series: Series;
    final: Point;
    gutter: number;
}) {
    const plot = usePlotArea();
    const scale = useYAxisScale();
    if (!plot) return null;
    const half = LABEL_LINE / 2;
    const alone = (at: number) =>
        Math.min(plot.y + plot.height - half, Math.max(plot.y + half, at));
    const centre = !scale
        ? y
        : final.spent === null
          ? alone(scale(final.earned) ?? y)
          : endPlaces(
                scale(final.earned) ?? y,
                scale(final.spent) ?? y,
                plot.y,
                plot.y + plot.height,
            )[series];
    return (
        <text
            x={plot.x + plot.width + gutter}
            y={centre}
            textAnchor="end"
            dominantBaseline="central"
            fill={series === "earned" ? "var(--accent-2)" : "var(--text-muted)"}
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
    // Spent and profit show only when every chosen day knows our provider cost
    const costKnown = points.every((p) => p.spent !== null);
    const shown: ChartConfig = costKnown ? config : { earned: config.earned };
    // The end values' gutter: as wide as the longer of them, and the y axis's gap before it
    const gutter = end
        ? axisWidth(
              [end.earned, ...(costKnown && end.spent !== null ? [end.spent] : [])].map((value) =>
                  formatUsdc(micros(value)),
              ),
          )
        : 0;
    const endLabel = (series: Series) =>
        function SeriesEndLabel({ y, value, index }: LabelProps & { index?: number }) {
            if (index !== last || end === undefined || typeof y !== "number") return null;
            return (
                <EndLabelText
                    y={y}
                    value={Number(value)}
                    series={series}
                    final={end}
                    gutter={gutter}
                />
            );
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
                    <ChartLegendContent config={shown} />
                    <RangeControl value={stats.range} onChange={stats.setRange} />
                </div>
                <div className="relative mt-(--space-4) h-(--chart) phone:h-(--chart-phone)">
                    {points.length > 0 && (
                        <ChartContainer config={shown} className="h-full w-full">
                            <ComposedChart
                                data={points}
                                barCategoryGap={1}
                                margin={{ top: 16, right: gutter, bottom: 0, left: 0 }}
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
                                            valueFormatter={(value, key, values) => {
                                                const { text, negative } = tooltipMoney(
                                                    value,
                                                    key,
                                                    values,
                                                );
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
                                {costKnown && (
                                    <>
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
                                            <LabelList
                                                dataKey="spent"
                                                content={endLabel("spent")}
                                            />
                                        </Line>
                                    </>
                                )}
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
