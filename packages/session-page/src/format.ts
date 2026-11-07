const byteUnits = ["B", "KiB", "MiB", "GiB", "TiB"] as const;

// A no-break space joins each number to its unit, so a narrow line never splits a value
const NB = "\u00a0";

export function formatBytes(n: number): string {
    if (!Number.isFinite(n) || n <= 0) return `0${NB}B`;
    let unit = 0;
    let value = n;
    while (value >= 1024 && unit < byteUnits.length - 1) {
        value /= 1024;
        unit++;
    }
    if (unit === 0) return `${Math.round(value)}${NB}B`;
    let shown = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
    if (shown >= 1024 && unit < byteUnits.length - 1) {
        shown = 1;
        unit++;
    }
    return `${shown}${NB}${byteUnits[unit]}`;
}

// Rounds down, so a ticking duration never shows more time than has passed
export function formatDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return `0${NB}s`;
    // A call that did take time must not read as taking none
    if (ms < 100) return `<0.1${NB}s`;
    if (ms < 10_000) return `${Math.floor(ms / 100) / 10}${NB}s`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}${NB}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}${NB}min${NB}${seconds % 60}${NB}s`;
    return `${Math.floor(minutes / 60)}${NB}h${NB}${minutes % 60}${NB}min`;
}

interface ClockFormats {
    time: Intl.DateTimeFormat;
    date: Intl.DateTimeFormat;
    day: Intl.DateTimeFormat;
}

// An event table can format thousands of times, and each formatter is costly to build
const clockFormats = new Map<string, ClockFormats>();

function formatsFor(timeZone: string | undefined): ClockFormats {
    const cacheKey = timeZone ?? "";
    let formats = clockFormats.get(cacheKey);
    if (!formats) {
        formats = {
            time: new Intl.DateTimeFormat("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23",
                timeZone,
            }),
            date: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone }),
            day: new Intl.DateTimeFormat("en-GB", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                timeZone,
            }),
        };
        clockFormats.set(cacheKey, formats);
    }
    return formats;
}

export function formatClock(d: Date, now: Date, timeZone?: string): string {
    const formats = formatsFor(timeZone);
    const time = formats.time.format(d);
    if (formats.day.format(d) === formats.day.format(now)) return time;
    return `${formats.date.format(d)} ${time}`;
}

/*
 * Null once less than a second is left, so a viewer clock that is off never shows a negative or
 * growing time, and the caller says nothing rather than "now left"
 */
export function formatLeft(target: Date, now: Date): string | null {
    const ms = target.getTime() - now.getTime();
    if (!Number.isFinite(ms) || ms < 1000) return null;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds} s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    // Under 2 h the hour alone would hide up to half the time left
    if (minutes < 120) return minutes === 60 ? "1 h" : `1 h ${minutes - 60} min`;
    return `${Math.floor(minutes / 60)} h`;
}

const USDC_DIGITS = 6;

/*
 * Integer arithmetic, so an amount never prints float noise such as 0.30000000000000004. A column
 * of amounts pads each fraction with zeros to its longest, so the decimal points line up
 */
export function formatUsdc(micros: number, minFraction = 0): string {
    const whole = Math.round(Math.abs(micros));
    const sign = micros < 0 && whole > 0 ? "-" : "";
    const units = Math.floor(whole / 1_000_000);
    const fraction = String(whole % 1_000_000)
        .padStart(USDC_DIGITS, "0")
        .replace(/0+$/, "")
        .padEnd(Math.min(minFraction, USDC_DIGITS), "0");
    return `${sign}${units}${fraction ? `.${fraction}` : ""} USDC`;
}

// The digits of a fraction formatUsdc prints with no padding
export function usdcFraction(micros: number): number {
    return (
        formatUsdc(micros)
            .replace(/ USDC$/, "")
            .split(".")[1]?.length ?? 0
    );
}

export const formatCount = new Intl.NumberFormat("en-GB").format;

export function shortSignature(tx: string): string {
    return tx.length <= 13 ? tx : `${tx.slice(0, 6)}…${tx.slice(-6)}`;
}

// Counts code points, so a cut never leaves half a surrogate pair
export function truncateLabel(s: string, max = 24): string {
    const points = Array.from(s);
    if (points.length <= max) return s;
    return `${points.slice(0, Math.max(0, max - 1)).join("")}…`;
}

// The count and the word, as in "1 call" or "12,345 calls"
export function plural(n: number, one: string, many: string): string {
    return `${formatCount(n)} ${n === 1 ? one : many}`;
}
