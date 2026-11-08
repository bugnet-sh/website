/** `memoryGiB` is each GPU's own memory; `model` is absent from a feed that predates it */
export type Gpu = { count: number; memoryGiB: number; model?: string | null };

export type DayRow = {
    day: string;
    earnedMicros: number;
    refundedMicros: number;
    allowanceReturnedMicros: number;
    x402SpentMicros: number;
    spentMicros: number;
    sandboxes: number;
    computeSeconds: number;
    peakActive: number;
    medianSeconds: number;
};

export type ProviderRow = {
    provider: string;
    sandboxes7d: number;
    active: number;
    /** Null under 5 samples. */
    startP50Ms: number | null;
    startP95Ms: number | null;
    failed7d: number;
};

export type PackageRow = {
    id: string;
    vcpu: number;
    memoryMiB: number;
    diskGiB: number;
    gpu: Gpu | null;
    minutes: number;
    priceMicros: number;
};

export const paymentKinds = ["sandbox", "extend", "x402_allowance", "x402_fee"] as const;
export const listKinds = [
    "sandbox",
    "extend",
    "x402_allowance",
    "refund",
    "allowance_return",
] as const;
export const endReasons = [
    "stop",
    "deadline",
    "provider_failed",
    "sandbox_exited",
    "stopped_by_bugnet",
    "no_capacity",
    "wallet_limit",
    "start_failed",
    "other",
] as const;
export const limitKeys = [
    "wallet.max_concurrent",
    "wallet.starts_per_hour",
    "wallet.starts_per_day",
    "wallet.bytes_per_day",
    "wallet.failed_refunds_per_day",
    "order.max_micros",
    "sandbox.max_running_jobs",
    "sandbox.max_previews",
    "sandbox.max_ssh_connections",
    "sandbox.max_secrets",
    "transfer.max_file_bytes",
    "gateway.quotes_per_minute",
    "x402.max_allowance_micros",
    "x402.max_price_per_call_micros",
] as const;

export type PaymentKind = (typeof paymentKinds)[number];
export type ListKind = (typeof listKinds)[number];
export type EndReason = (typeof endReasons)[number];
export type LimitKey = (typeof limitKeys)[number];

export type StatsSummary = {
    version: 1;
    generatedAt: string;
    now: { active: number; activeByProvider: { provider: string; active: number }[] };
    totals: {
        sandboxes: number;
        computeSeconds: number;
        earnedMicros: number;
        refundedMicros: number;
        allowanceReturnedMicros: number;
        x402SpentMicros: number;
        spentMicros: number;
    };
    daily: DayRow[];
    providers: ProviderRow[];
    payments: {
        byKind: { kind: PaymentKind; count: number; micros: number }[];
        byMethod: { method: string; count: number; micros: number }[];
        refunds: { count: number; micros: number };
    };
    packages: PackageRow[];
    limits: Partial<Record<LimitKey, number>>;
};

export type SessionRow = {
    startedAt: string;
    endedAt: string | null;
    provider: string | null;
    vcpu: number | null;
    memoryMiB: number | null;
    gpu: Gpu | null;
    seconds: number;
    commands: number;
    priceMicros: number;
    status: "running" | "ended" | "failed";
    endReason: EndReason | null;
    /** Null unless it decoded to 32 bytes. */
    wallet: string | null;
    /** Null unless it decoded to 64 bytes. */
    tx: string | null;
};

export type PaymentRow = {
    at: string;
    kind: ListKind;
    amountMicros: number;
    method: string | null;
    wallet: string | null;
    tx: string | null;
};

export type Page<T> = { items: T[]; next: string | null };
