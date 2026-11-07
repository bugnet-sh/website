import type { SummaryState } from "./client";
import { formatUsdc } from "./format";
import type { DayRow } from "./types";

export type Range = "7d" | "30d" | "90d" | "all";

export const ranges: readonly { value: Range; label: string; name: string; days?: number }[] = [
    { value: "7d", label: "7 d", name: "7 days", days: 7 },
    { value: "30d", label: "30 d", name: "30 days", days: 30 },
    { value: "90d", label: "90 d", name: "90 days", days: 90 },
    { value: "all", label: "All", name: "All days" },
];

/** A young deployment shows its whole history rather than a range it cannot fill. */
export const defaultRange = (days: number): Range => (days < 30 ? "all" : "30d");

/** The feed lists every day through today, oldest first, so a range is its newest rows. */
export function rangeDays(daily: readonly DayRow[], range: Range): readonly DayRow[] {
    const days = ranges.find((r) => r.value === range)?.days;
    return days === undefined ? daily : daily.slice(-days);
}

export const STALE_MS = 5 * 60_000;

/**
 * The money part of the feed can lag the router part, so data that was already old when it
 * arrived is as doubtful as a failed refresh.
 */
export function isStale({ data, updatedAt, failedAt }: SummaryState): boolean {
    if (failedAt !== null && (updatedAt === null || failedAt > updatedAt)) return true;
    if (data === null || updatedAt === null) return false;
    return updatedAt.getTime() - Date.parse(data.generatedAt) > STALE_MS;
}

const two = (n: number) => String(n).padStart(2, "0");

export function formatClock(iso: string): string {
    const at = new Date(iso);
    return `${two(at.getHours())}:${two(at.getMinutes())}:${two(at.getSeconds())}`;
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A feed day is a UTC date, read from its text so no time zone can move it. */
export function formatDay(day: string): string {
    const [, month = "1", date = "1"] = day.split("-");
    return `${Number(date)} ${months[Number(month) - 1] ?? ""}`;
}

const count = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const hours = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});

export const formatCount = (n: number): string => count.format(n);
export const formatHours = (seconds: number): string => hours.format(seconds / 3600);

/** A typographic minus, and only when the amount still reads as non-zero once rounded. */
export function signedUsdc(micros: number): { text: string; negative: boolean } {
    const text = formatUsdc(micros);
    return text.startsWith("-")
        ? { text: `−${text.slice(1)}`, negative: true }
        : { text, negative: false };
}
