import { formatUsdc } from "./format";
import type {
    EndReason,
    Gpu,
    LimitKey,
    ListKind,
    PaymentKind,
    ProviderRow,
    SessionRow,
    StatsSummary,
} from "./types";
import { formatCount, months } from "./view";

const providers: Record<string, string> = {
    boat: "Boat",
    e2b: "E2B",
    koyeb: "Koyeb",
    boxd: "boxd",
};

/** A provider the page does not know yet is shown as the feed sent it, always as text. */
export const providerLabel = (name: string): string => providers[name] ?? name;

export const kindLabels: Record<PaymentKind, string> = {
    sandbox: "Sandboxes",
    extend: "Extensions",
    x402_allowance: "x402 allowance",
    x402_fee: "x402 session fee",
};

export const listKindLabels: Record<ListKind, string> = {
    sandbox: "Sandbox",
    extend: "Extension",
    x402_allowance: "x402 allowance",
    refund: "Refund",
    allowance_return: "Allowance returned",
};

/** Money going back to a user, which the payments table shows as a minus. */
export const isOutgoing = (kind: ListKind): boolean =>
    kind === "refund" || kind === "allowance_return";

const methods: Record<string, string> = { checkout: "Checkout page", pay_cli: "pay CLI" };

export const methodLabel = (method: string): string => methods[method] ?? method;

/** The payment methods the page names, which a box waiting for the feed keeps rows for. */
export const knownMethods: readonly string[] = Object.keys(methods);

/** The providers the page names, which a box waiting for the feed keeps rows for. */
export const knownProviders: readonly string[] = Object.keys(providers);

const reasons: Record<EndReason, string> = {
    stop: "stopped",
    deadline: "deadline",
    provider_failed: "provider failed",
    sandbox_exited: "sandbox exited",
    stopped_by_bugnet: "stopped by Bugnet",
    no_capacity: "no capacity",
    wallet_limit: "wallet limit",
    start_failed: "start failed",
    other: "other",
};

export function statusText({ status, endReason }: Pick<SessionRow, "status" | "endReason">): {
    text: string;
    bad: boolean;
} {
    if (status === "running") return { text: "Running", bad: false };
    const word = endReason === null ? null : reasons[endReason];
    if (status === "failed") return { text: word ? `Failed: ${word}` : "Failed", bad: true };
    return { text: word ? `Ended: ${word}` : "Ended", bad: false };
}

const units = ["B", "KiB", "MiB", "GiB", "TiB"];
const oneDecimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export function formatBytes(bytes: number): string {
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }
    return `${oneDecimal.format(value)} ${units[unit]}`;
}

const limitUsdc = (micros: number) => `${formatUsdc(micros)} USDC`;

export function sizeText({
    vcpu,
    memoryMiB,
    gpu,
}: {
    vcpu: number | null;
    memoryMiB: number | null;
    gpu: Gpu | null;
}): string {
    // The feed sends all three as null once a package has left the catalog
    if (vcpu === null || memoryMiB === null) return "";
    const base = `${vcpu} vCPU, ${formatBytes(memoryMiB * 1024 * 1024)}`;
    return gpu ? `${base}, ${gpu.count} GPU ${gpu.memoryGiB} GiB` : base;
}

type Format = "count" | "bytes" | "usdc";

const limits: { key: LimitKey; label: string; format: Format; tip?: string }[] = [
    {
        key: "wallet.max_concurrent",
        label: "Sandboxes running at once, per wallet",
        format: "count",
        tip: "Starting a sixth waits until one ends.",
    },
    { key: "wallet.starts_per_hour", label: "Starts per hour, per wallet", format: "count" },
    { key: "wallet.starts_per_day", label: "Starts per day, per wallet", format: "count" },
    {
        key: "wallet.bytes_per_day",
        label: "Traffic per day, per wallet",
        format: "bytes",
        tip: "Previews, transfers and SSH, per UTC day.",
    },
    {
        key: "wallet.failed_refunds_per_day",
        label: "Refunds for failed starts, per wallet per day",
        format: "count",
    },
    { key: "order.max_micros", label: "Largest single payment", format: "usdc" },
    {
        key: "sandbox.max_running_jobs",
        label: "Commands running at once, per sandbox",
        format: "count",
    },
    { key: "sandbox.max_previews", label: "Previews per sandbox", format: "count" },
    { key: "sandbox.max_ssh_connections", label: "SSH connections per sandbox", format: "count" },
    { key: "sandbox.max_secrets", label: "Secrets per sandbox", format: "count" },
    { key: "transfer.max_file_bytes", label: "Largest file transfer", format: "bytes" },
    { key: "gateway.quotes_per_minute", label: "Price quotes per minute, per IP", format: "count" },
    {
        key: "x402.max_allowance_micros",
        label: "Largest x402 allowance per sandbox",
        format: "usdc",
    },
    { key: "x402.max_price_per_call_micros", label: "Most an x402 call may cost", format: "usdc" },
];

export function formatLimit(key: LimitKey, value: number): string {
    const format = limits.find((l) => l.key === key)?.format ?? "count";
    if (format === "bytes") return formatBytes(value);
    if (format === "usdc") return limitUsdc(value);
    return formatCount(value);
}

/** Only the limits the feed sends: one it leaves out binds no one yet. */
export function limitRows(
    sent: StatsSummary["limits"],
): { key: LimitKey; label: string; value: string; tip?: string }[] {
    return limits.flatMap(({ key, label, tip }) => {
        const value = sent[key];
        return value === undefined ? [] : [{ key, label, value: formatLimit(key, value), tip }];
    });
}

/** Days when no session ended send 0, which is no length at all, so they are left out. */
export function median(values: readonly number[]): number {
    const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
    if (sorted.length === 0) return 0;
    const mid = Math.floor(sorted.length / 2);
    const upper = sorted[mid] as number;
    return sorted.length % 2 ? upper : Math.floor(((sorted[mid - 1] as number) + upper) / 2);
}

const percent = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});

/**
 * Failed starts never reach `sandboxes7d`, so a provider that only failed would divide by zero
 * or pass 100 %; the rate stops there.
 */
export function failureRate({
    failed7d,
    sandboxes7d,
}: Pick<ProviderRow, "failed7d" | "sandboxes7d">): string {
    if (failed7d === null) return "Unavailable";
    if (failed7d === 0) return "None";
    const rate = sandboxes7d === 0 ? 1 : Math.min(1, failed7d / sandboxes7d);
    return `${percent.format(rate * 100)} %`;
}

export function formatStartMs(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)} ms`;
    if (ms < 60_000) return `${percent.format(ms / 1000)} s`;
    return `${Math.floor(ms / 60_000)} min ${Math.floor((ms % 60_000) / 1000)} s`;
}

const two = (n: number) => String(n).padStart(2, "0");

/** A table's time, in the reader's own zone: "7 Nov 14:02". */
export function formatStamp(iso: string): string {
    const at = new Date(iso);
    return `${at.getDate()} ${months[at.getMonth()]} ${two(at.getHours())}:${two(at.getMinutes())}`;
}

/** A part's share of a whole, 0 when the whole is nothing yet. */
export const share = (part: number, total: number): number => (total > 0 ? part / total : 0);

/** A whole percentage, as the share bars read: "42 %". */
export const formatShare = (part: number, total: number): string =>
    `${Math.round(share(part, total) * 100)} %`;
