import { isTx, isWallet } from "./base58";
import {
    endReasons,
    limitKeys,
    listKinds,
    paymentKinds,
    type DayRow,
    type EndReason,
    type Gpu,
    type LimitKey,
    type ListKind,
    type Page,
    type PackageRow,
    type PaymentKind,
    type PaymentRow,
    type ProviderRow,
    type SessionRow,
    type StatsSummary,
} from "./types";

// The feed is untrusted, so every reader throws on a wrong shape and the entry points catch it
class Bad extends Error {}

type Obj = Record<string, unknown>;

function obj(v: unknown): Obj {
    if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Bad();
    return v as Obj;
}

function arr(v: unknown): unknown[] {
    if (!Array.isArray(v)) throw new Bad();
    return v;
}

/** A count or an amount: a non-negative integer a double holds exactly. */
function int(v: unknown): number {
    if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) throw new Bad();
    return v;
}

function str(v: unknown): string {
    if (typeof v !== "string") throw new Bad();
    return v;
}

function time(v: unknown): string {
    const s = str(v);
    if (Number.isNaN(Date.parse(s))) throw new Bad();
    return s;
}

const orNull = <T>(v: unknown, read: (v: unknown) => T): T | null => (v === null ? null : read(v));

function oneOf<T extends string>(list: readonly T[], v: unknown): T {
    const s = str(v);
    if (!(list as readonly string[]).includes(s)) throw new Bad();
    return s as T;
}

function gpu(v: unknown): Gpu | null {
    return orNull(v, (g) => {
        const o = obj(g);
        const model = typeof o.model === "string" && o.model.trim() ? o.model.trim() : null;
        return { count: int(o.count), memoryGiB: int(o.memoryGiB), model };
    });
}

function day(v: unknown): DayRow {
    const o = obj(v);
    const d = str(o.day);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) throw new Bad();
    return {
        day: d,
        earnedMicros: int(o.earnedMicros),
        refundedMicros: int(o.refundedMicros),
        allowanceReturnedMicros: int(o.allowanceReturnedMicros),
        x402SpentMicros: int(o.x402SpentMicros),
        spentMicros: orNull(o.spentMicros, int),
        sandboxes: int(o.sandboxes),
        computeSeconds: int(o.computeSeconds),
        peakActive: int(o.peakActive),
        medianSeconds: int(o.medianSeconds),
    };
}

function provider(v: unknown): ProviderRow {
    const o = obj(v);
    return {
        provider: str(o.provider),
        sandboxes7d: int(o.sandboxes7d),
        active: int(o.active),
        startP50Ms: orNull(o.startP50Ms, int),
        startP95Ms: orNull(o.startP95Ms, int),
        failed7d: orNull(o.failed7d, int),
    };
}

function pack(v: unknown): PackageRow {
    const o = obj(v);
    return {
        id: str(o.id),
        vcpu: int(o.vcpu),
        memoryMiB: int(o.memoryMiB),
        diskGiB: int(o.diskGiB),
        gpu: gpu(o.gpu),
        minutes: int(o.minutes),
        priceMicros: int(o.priceMicros),
    };
}

function limits(v: unknown): StatsSummary["limits"] {
    const o = obj(v);
    const known: Partial<Record<LimitKey, number>> = {};
    for (const key of limitKeys) if (key in o) known[key] = int(o[key]);
    return known;
}

function summary(json: unknown): StatsSummary {
    const o = obj(json);
    if (o.version !== 1) throw new Bad();
    const now = obj(o.now);
    const totals = obj(o.totals);
    const payments = obj(o.payments);
    const refunds = obj(payments.refunds);
    return {
        version: 1,
        generatedAt: time(o.generatedAt),
        now: {
            active: int(now.active),
            activeByProvider: arr(now.activeByProvider).map((p) => {
                const r = obj(p);
                return { provider: str(r.provider), active: int(r.active) };
            }),
        },
        totals: {
            sandboxes: int(totals.sandboxes),
            computeSeconds: int(totals.computeSeconds),
            earnedMicros: int(totals.earnedMicros),
            refundedMicros: int(totals.refundedMicros),
            allowanceReturnedMicros: int(totals.allowanceReturnedMicros),
            x402SpentMicros: int(totals.x402SpentMicros),
            spentMicros: orNull(totals.spentMicros, int),
        },
        daily: arr(o.daily).map(day),
        providers: arr(o.providers).map(provider),
        payments: {
            byKind: arr(payments.byKind).map((k) => {
                const r = obj(k);
                return {
                    kind: oneOf<PaymentKind>(paymentKinds, r.kind),
                    count: int(r.count),
                    micros: int(r.micros),
                };
            }),
            byMethod: arr(payments.byMethod).map((m) => {
                const r = obj(m);
                return { method: str(r.method), count: int(r.count), micros: int(r.micros) };
            }),
            refunds: { count: int(refunds.count), micros: int(refunds.micros) },
        },
        packages: arr(o.packages).map(pack),
        limits: limits(o.limits),
    };
}

// A wallet or tx that fails the byte check loses its field, not its row
const checked = (v: unknown, ok: (s: string) => boolean): string | null => {
    if (typeof v !== "string") {
        if (v === null || v === undefined) return null;
        throw new Bad();
    }
    return ok(v) ? v : null;
};

function endReason(v: unknown): EndReason {
    const s = str(v);
    return (endReasons as readonly string[]).includes(s) ? (s as EndReason) : "other";
}

function session(v: unknown): SessionRow {
    const o = obj(v);
    return {
        startedAt: time(o.startedAt),
        endedAt: orNull(o.endedAt, time),
        provider: orNull(o.provider, str),
        vcpu: orNull(o.vcpu, int),
        memoryMiB: orNull(o.memoryMiB, int),
        gpu: gpu(o.gpu),
        seconds: int(o.seconds),
        commands: int(o.commands),
        priceMicros: int(o.priceMicros),
        status: oneOf(["running", "ended", "failed"] as const, o.status),
        endReason: orNull(o.endReason, endReason),
        wallet: checked(o.wallet, isWallet),
        tx: checked(o.tx, isTx),
    };
}

function payment(v: unknown): PaymentRow {
    const o = obj(v);
    return {
        at: time(o.at),
        kind: oneOf<ListKind>(listKinds, o.kind),
        amountMicros: int(o.amountMicros),
        // Absent on refunds and returns
        method: o.method === undefined ? null : orNull(o.method, str),
        wallet: checked(o.wallet, isWallet),
        tx: checked(o.tx, isTx),
    };
}

function page<T>(json: unknown, row: (v: unknown) => T): Page<T> {
    const o = obj(json);
    return { items: arr(o.items).map(row), next: orNull(o.next, str) };
}

function guard<T>(read: () => T): T | null {
    try {
        return read();
    } catch (e) {
        if (e instanceof Bad) return null;
        throw e;
    }
}

export const parseSummary = (json: unknown): StatsSummary | null => guard(() => summary(json));
export const parseSessions = (json: unknown): Page<SessionRow> | null =>
    guard(() => page(json, session));
export const parsePayments = (json: unknown): Page<PaymentRow> | null =>
    guard(() => page(json, payment));
