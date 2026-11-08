import { Text, usePlotArea, type XAxisTickContentProps } from "recharts";
import { formatUsdc, profit } from "../../lib/stats/format";
import type { DayRow } from "../../lib/stats/types";
import { formatCount, formatDay } from "../../lib/stats/view";

export type Scale = { domain: [number, number]; ticks: number[]; decimals: number };

/** Round steps (1, 2, 2.5 or 5 times a power of ten), so ticks read 0, 2.5, 5 rather than 2.78. */
function niceStep(span: number): number {
    const raw = span / 4;
    const power = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= raw) ?? 10;
    return step * power;
}

/** The fewest decimals that write every multiple of the step exactly: 2.5 needs one, 5 none. */
function decimalsOf(step: number): number {
    for (let decimals = 0; decimals < 6; decimals++) {
        const scaled = step * 10 ** decimals;
        if (Math.abs(scaled - Math.round(scaled)) < 1e-9) return decimals;
    }
    return 6;
}

/**
 * The range of the values widened to whole steps, and its ticks. Zero is always a tick, so a bar
 * grows from it, and all-zero values still span 0 to 1 rather than one value repeated. A count
 * passes a least step of 1, so its axis never reads 0.25 of a sandbox.
 */
export function niceScale(values: readonly number[], least = 0): Scale {
    const low = Math.min(0, ...values);
    const high = Math.max(0, ...values);
    if (low === high) return { domain: [0, 1], ticks: [0, 1], decimals: 0 };
    const step = Math.max(least, niceStep(high - low));
    const from = Math.floor(low / step) * step;
    const to = Math.ceil(high / step) * step;
    const ticks: number[] = [];
    for (let i = 0; from + i * step <= to + step / 1e6; i++) {
        ticks.push(Number((from + i * step).toFixed(6)));
    }
    return { domain: [from, to], ticks, decimals: decimalsOf(step) };
}

/** Obel Mono's advance at --tick-size (11 px), the same for every character. */
const TICK_ADVANCE = 6.6;
/** Recharts' gap between a y tick's text and the plot: its tick size plus its tick margin. */
const TICK_GAP = 8;

/**
 * A y axis wide enough for its longest label. The charts stacked on the page all take the widest
 * of theirs, so each plot starts at the same x.
 */
export function axisWidth(labels: readonly string[]): number {
    const longest = Math.max(1, ...labels.map((l) => l.length));
    return Math.ceil(longest * TICK_ADVANCE) + TICK_GAP;
}

/** A day tick, its anchor at the plot's edge for the first and last days, else its centre. */
function DayTickText({
    props,
    first,
    last,
}: {
    props: XAxisTickContentProps;
    first: string | undefined;
    last: string | undefined;
}) {
    const plot = usePlotArea();
    const value = String(props.payload.value);
    const anchor = plot && value === last ? "end" : plot && value === first ? "start" : "middle";
    const x =
        plot === undefined || anchor === "middle"
            ? props.x
            : anchor === "end"
              ? plot.x + plot.width
              : plot.x;
    return (
        <Text
            x={x}
            y={props.y}
            textAnchor={anchor}
            verticalAnchor={props.verticalAnchor}
            className="recharts-cartesian-axis-tick-value"
        >
            {formatDay(value)}
        </Text>
    );
}

/**
 * The x axis's day ticks. The first and last days' ticks align to the plot's edges, where a
 * centred tick would hang under the y axis or past the frame's edge.
 */
export function dayTick(first: string | undefined, last: string | undefined) {
    return function DayTick(props: XAxisTickContentProps) {
        return <DayTickText props={props} first={first} last={last} />;
    };
}

/** A money tick in USDC, every tick on the axis written to the same decimals. */
export const moneyTick = (usdc: number, decimals: number): string =>
    formatUsdc(Math.round(usdc * 1_000_000), { decimals });

/** The money chart's y scale over some days, in USDC. */
export const moneyScale = (days: readonly DayRow[]): Scale =>
    niceScale(
        days.flatMap((d) =>
            [d.earnedMicros, d.spentMicros, profit(d)].flatMap((m) =>
                m === null ? [] : [m / 1e6],
            ),
        ),
    );

/** The usage chart's y scale: sandboxes started per day. */
export const usageScale = (days: readonly DayRow[]): Scale =>
    niceScale(
        days.map((d) => d.sandboxes),
        1,
    );

/** The one y axis width both charts use over the chosen days. */
export function sharedAxisWidth(days: readonly DayRow[]): number {
    const money = moneyScale(days);
    const usage = usageScale(days);
    return axisWidth([
        ...money.ticks.map((t) => moneyTick(t, money.decimals)),
        ...usage.ticks.map(formatCount),
    ]);
}
