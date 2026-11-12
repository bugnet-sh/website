export type DayMoney = {
    earnedMicros: number;
    refundedMicros: number;
    /** Null while the feed does not know our provider cost yet */
    spentMicros: number | null;
};

/** Allowance returned and x402 spent are the users' money and never enter it; unknown while spent is. */
export const profit = (day: DayMoney): number | null =>
    day.spentMicros === null ? null : day.earnedMicros - day.refundedMicros - day.spentMicros;

const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** The decimals an amount needs to print exact to the micro, two at least: 25 000 micros needs 3. */
export function usdcDecimals(micros: number): number {
    if (!Number.isFinite(micros)) return 2;
    const fraction = Math.round(Math.abs(micros)) % 1_000_000;
    if (fraction === 0) return 2;
    return Math.max(2, String(fraction).padStart(6, "0").replace(/0+$/, "").length);
}

/** One precision for a column of amounts, so their points line up and each stays exact. */
export const alignedDecimals = (amounts: readonly number[]): number =>
    Math.max(2, ...amounts.map(usdcDecimals));

/**
 * Bugnet's one money format: a plain number with thousands separators and no currency sign, exact
 * to the micro in the decimals it needs and at least two, so 50 000 micros is "0.05" and 52 442 is
 * "0.052442". `decimals` fixes the count instead, rounding, for a chart's ticks. Integer maths, so
 * an amount never prints float noise.
 */
export function formatUsdc(micros: number, opts: { decimals?: number } = {}): string {
    if (!Number.isFinite(micros)) return "0.00";
    const decimals = Math.min(6, Math.max(0, opts.decimals ?? usdcDecimals(micros)));
    const step = 10 ** (6 - decimals);
    const units = Math.round(Math.abs(micros) / step);
    const whole = Math.floor(units / 10 ** decimals);
    const fraction = String(units % 10 ** decimals).padStart(decimals, "0");
    const sign = micros < 0 && units > 0 ? "-" : "";
    return `${sign}${group(whole)}${decimals ? `.${fraction}` : ""}`;
}

export function formatDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 1) return "0 s";
    const s = Math.floor(seconds);
    if (s < 60) return `${s} s`;
    const minutes = Math.floor(s / 60);
    if (minutes < 60) return `${minutes} min`;
    const rest = minutes % 60;
    return rest === 0 ? `${minutes / 60} h` : `${Math.floor(minutes / 60)} h ${rest} min`;
}

export const formatShortWallet = (w: string): string =>
    w.length <= 9 ? w : `${w.slice(0, 4)}…${w.slice(-4)}`;
