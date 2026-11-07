"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { formatDuration } from "../../lib/stats/format";
import { median } from "../../lib/stats/labels";
import { formatCount, formatDay, formatHours, rangeDays, ranges } from "../../lib/stats/view";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../ui/chart";
import { Facts, Panel, SectionTitle } from "./panels";
import { useStats } from "./stats-provider";
import { isUnavailable, Unavailable } from "./unavailable";

const config = {
    sandboxes: { label: "Sandboxes started", color: "var(--text-muted)", marker: "square" },
} satisfies ChartConfig;

/** A day with no starts still spans 0 to 1, so the axis never repeats one value. */
const top = (max: number) => Math.max(1, max);

/** Band 4, left: sandboxes started per UTC day over the money chart's range. */
export function Usage() {
    const stats = useStats();
    const days = stats.data ? rangeDays(stats.data.daily, stats.range) : [];
    const points = days.map((d) => ({ day: d.day, sandboxes: d.sandboxes }));
    const facts = [
        {
            label: "Compute hours",
            value: formatHours(days.reduce((sum, d) => sum + d.computeSeconds, 0)),
        },
        {
            label: "Most running at once",
            value: formatCount(days.reduce((most, d) => Math.max(most, d.peakActive), 0)),
        },
        {
            label: "Median session",
            value: formatDuration(median(days.map((d) => d.medianSeconds))),
        },
    ];
    return (
        <Panel>
            <div className="flex items-baseline justify-between gap-(--space-3)">
                <SectionTitle>Usage over time</SectionTitle>
                <span className="text-(length:--fine-size) leading-(--fine-line) text-text-muted">
                    {ranges.find((r) => r.value === stats.range)?.name}
                </span>
            </div>
            <div className="mt-(--space-4) grid grid-cols-[minmax(0,1fr)_auto] gap-(--space-5) phone:grid-cols-1">
                <div className="h-(--panel-chart)">
                    {points.length > 0 && (
                        <ChartContainer config={config} className="h-full w-full">
                            <BarChart
                                data={points}
                                barCategoryGap={1}
                                margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
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
                                    domain={[0, top]}
                                    allowDecimals={false}
                                    width="auto"
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <ChartTooltip
                                    cursor={{ fill: "var(--surface-hover)" }}
                                    isAnimationActive={false}
                                    content={<ChartTooltipContent labelFormatter={formatDay} />}
                                />
                                <Bar
                                    dataKey="sandboxes"
                                    fill="var(--color-sandboxes)"
                                    isAnimationActive={false}
                                />
                            </BarChart>
                        </ChartContainer>
                    )}
                </div>
                <Facts items={stats.data ? facts : facts.map((f) => ({ ...f, value: null }))} />
            </div>
            {isUnavailable(stats) && <Unavailable />}
        </Panel>
    );
}
