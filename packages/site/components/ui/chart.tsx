"use client";

/**
 * shadcn's chart component for Recharts 3, restyled with the brand tokens. Two departures from
 * the registry copy: series colours are set as inline custom properties, since the site never
 * injects a <style> element, and each series names a marker so the legend and tooltip never tell
 * series apart by colour alone.
 */

import {
    createContext,
    useContext,
    useId,
    type ComponentProps,
    type CSSProperties,
    type ReactNode,
} from "react";
import * as Recharts from "recharts";
import type { LegendPayload, TooltipContentProps } from "recharts";
import { cx } from "../../lib/cx";

export type ChartMarker = "line" | "dashed" | "square";

export type ChartConfig = Record<string, { label: ReactNode; color: string; marker?: ChartMarker }>;

const ChartContext = createContext<ChartConfig | null>(null);

function useChartConfig(): ChartConfig {
    const config = useContext(ChartContext);
    if (config === null) throw new Error("A chart part must sit inside a <ChartContainer />");
    return config;
}

/** Each series' colour as `--color-<key>`, so marks and markers name one variable. */
function seriesColours(config: ChartConfig): CSSProperties {
    return Object.fromEntries(
        Object.entries(config).map(([key, { color }]) => [`--color-${key}`, color]),
    ) as CSSProperties;
}

export function ChartContainer({
    config,
    className,
    children,
    style,
    ...props
}: Omit<ComponentProps<"div">, "children"> & {
    config: ChartConfig;
    children: ComponentProps<typeof Recharts.ResponsiveContainer>["children"];
}) {
    const id = useId();
    return (
        <ChartContext.Provider value={config}>
            <div
                data-slot="chart"
                data-chart={id}
                className={cx(
                    "flex justify-center font-mono text-(length:--tick-size) [&_.recharts-cartesian-axis-tick-value]:fill-text-muted",
                    className,
                )}
                style={{ ...seriesColours(config), ...style }}
                {...props}
            >
                <Recharts.ResponsiveContainer>{children}</Recharts.ResponsiveContainer>
            </div>
        </ChartContext.Provider>
    );
}

export function ChartMarkerIcon({
    marker = "square",
    color,
}: {
    marker?: ChartMarker;
    color: string;
}) {
    if (marker === "square") {
        return (
            <span aria-hidden className="size-(--space-2) shrink-0" style={{ background: color }} />
        );
    }
    return (
        <span
            aria-hidden
            className={cx(
                "w-(--space-4) shrink-0 border-t-(length:--ring)",
                marker === "dashed" && "border-dashed",
            )}
            style={{ borderColor: color }}
        />
    );
}

export const ChartTooltip = Recharts.Tooltip;

/** The hovered day, then each series with its marker and value. */
export function ChartTooltipContent({
    active,
    payload,
    label,
    labelFormatter,
    valueFormatter,
}: Partial<Pick<TooltipContentProps, "active" | "payload" | "label">> & {
    labelFormatter?: (label: string) => ReactNode;
    valueFormatter?: (value: number, key: string) => ReactNode;
}) {
    const config = useChartConfig();
    const order = Object.keys(config);
    const rank = (item: { dataKey?: unknown; name?: unknown }) =>
        order.indexOf(String(item.dataKey ?? item.name));
    // In the config's order, as the legend lists them, not the order the marks are drawn in
    const items = (payload ?? [])
        .filter((item) => item.type !== "none")
        .sort((a, b) => rank(a) - rank(b));
    if (!active || items.length === 0) return null;
    return (
        <div className="grid gap-(--space-2) border-(length:--hairline) border-line bg-surface px-(--space-3) py-(--space-2) font-ui text-(length:--fine-size) leading-(--fine-line) text-text">
            {label !== undefined && (
                <div className="font-semibold">
                    {labelFormatter ? labelFormatter(String(label)) : label}
                </div>
            )}
            <div className="grid gap-(--space-1)">
                {items.map((item) => {
                    const key = String(item.dataKey ?? item.name);
                    const series = config[key];
                    const value = Number(item.value);
                    return (
                        <div key={key} className="flex items-center gap-(--space-2)">
                            <ChartMarkerIcon
                                marker={series?.marker}
                                color={`var(--color-${key})`}
                            />
                            <span className="text-text-muted">{series?.label ?? key}</span>
                            <span className="ml-auto pl-(--space-4) font-mono tabular-nums">
                                {valueFormatter ? valueFormatter(value, key) : value}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export const ChartLegend = Recharts.Legend;

/**
 * Inside a chart it lists Recharts' payload. Outside one, as on the stats page where the legend
 * shares a row with the range control, it lists the config it is given.
 */
export function ChartLegendContent({
    payload,
    config: given,
    className,
}: {
    payload?: readonly LegendPayload[];
    config?: ChartConfig;
    className?: string;
}) {
    const context = useContext(ChartContext);
    const config = given ?? context;
    if (config === null) return null;
    const keys = payload
        ? payload.filter((item) => item.type !== "none").map((item) => String(item.dataKey))
        : Object.keys(config);
    return (
        <ul
            className={cx(
                "flex flex-wrap items-center gap-x-(--space-5) gap-y-(--space-2)",
                className,
            )}
        >
            {keys.map((key) => {
                const series = config[key];
                if (series === undefined) return null;
                return (
                    <li
                        key={key}
                        className="flex items-center gap-(--space-2) text-(length:--fine-size) leading-(--fine-line) text-text-muted"
                    >
                        <ChartMarkerIcon marker={series.marker} color={series.color} />
                        {series.label}
                    </li>
                );
            })}
        </ul>
    );
}
