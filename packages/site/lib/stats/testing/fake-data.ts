// Dev and tests only: the build test fails if any value here reaches out/.
export type Scenario = "normal" | "empty" | "one-day" | "hostile" | "down" | "bad-shape";

export const scenarios: readonly Scenario[] = [
    "normal",
    "empty",
    "one-day",
    "hostile",
    "down",
    "bad-shape",
];

export const PAGE_SIZE = 50;
const FIXED_NOW = new Date("2026-11-07T14:02:31Z");
const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function encodeBase58(bytes: Uint8Array): string {
    const digits: number[] = [];
    for (const b of bytes) {
        let carry = b;
        for (let i = 0; i < digits.length; i++) {
            carry += (digits[i] as number) << 8;
            digits[i] = carry % 58;
            carry = Math.floor(carry / 58);
        }
        while (carry > 0) {
            digits.push(carry % 58);
            carry = Math.floor(carry / 58);
        }
    }
    let zeros = 0;
    while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
    return (
        "1".repeat(zeros) +
        digits
            .reverse()
            .map((d) => alphabet[d])
            .join("")
    );
}

function rng(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function bytesOf(size: number, salt: number): Uint8Array {
    const next = rng(0xfa4e0000 + salt);
    return Uint8Array.from({ length: size }, () => 1 + Math.floor(next() * 255));
}

/** A fixed pool, so the build test can search out/ for every value. */
export const fakeWallets = Array.from({ length: 8 }, (_, i) => encodeBase58(bytesOf(32, i)));
export const fakeTxs = Array.from({ length: 8 }, (_, i) => encodeBase58(bytesOf(64, 100 + i)));
export const badWallet = "0OIl-fake-not-base58-wallet";
export const shortTx = encodeBase58(bytesOf(63, 200));
export const hostileProvider = "<img src=x onerror=alert('fake-hostile')>";
export const longProvider = `fake-long-${"x".repeat(1990)}`;

/** Every fake wallet and tx and each hostile string, for the build test. */
export const fakeValues = [
    ...fakeWallets,
    ...fakeTxs,
    badWallet,
    shortTx,
    hostileProvider,
    longProvider,
];

const providers = ["boat", "e2b", "koyeb", "boxd"];
const dayMs = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const isoSecond = (ms: number) => `${new Date(ms).toISOString().slice(0, 19)}Z`;

function dayCount(scenario: Scenario): number {
    return scenario === "normal" || scenario === "hostile" ? 90 : 1;
}

export function fakeSummary(seed: number, scenario: Scenario, now: Date = FIXED_NOW): unknown {
    if (scenario === "down") return null;
    if (scenario === "bad-shape") return { version: 1, generatedAt: isoSecond(now.getTime()) };
    const next = rng(seed);
    const hostile = scenario === "hostile";
    const zero = scenario === "empty";
    // Daily figures reach 10^12 micros, the most a feed value may hold here
    const big = hostile ? 333_333 : 1;
    const names = hostile ? [hostileProvider, longProvider, ...providers.slice(0, 2)] : providers;
    const today = Math.floor(now.getTime() / dayMs) * dayMs;
    const days = dayCount(scenario);
    const daily = Array.from({ length: days }, (_, i) => {
        const earned = zero ? 0 : Math.round(next() * 3_000_000) * big;
        // Some days cost more than they earn
        const spent = zero ? 0 : Math.round(next() * 3_000_000 * (i % 7 === 3 ? 2 : 0.6)) * big;
        return {
            day: isoDay(today - (days - 1 - i) * dayMs),
            earnedMicros: earned,
            refundedMicros: zero ? 0 : Math.round(earned * next() * 0.1),
            allowanceReturnedMicros: zero ? 0 : Math.round(next() * 100_000),
            x402SpentMicros: zero ? 0 : Math.round(next() * 200_000),
            spentMicros: spent,
            sandboxes: zero ? 0 : Math.floor(next() * 40),
            computeSeconds: zero ? 0 : Math.floor(next() * 40_000),
            peakActive: zero ? 0 : Math.floor(next() * 8),
            medianSeconds: zero ? 0 : Math.floor(next() * 900),
        };
    });
    const sum = (key: keyof (typeof daily)[number]) =>
        daily.reduce((total, d) => total + (d[key] as number), 0);
    const now0 = zero ? 0 : 3;
    return {
        version: 1,
        generatedAt: isoSecond(now.getTime()),
        now: {
            active: now0,
            activeByProvider: zero ? [] : [{ provider: names[0], active: now0 }],
        },
        totals: {
            sandboxes: sum("sandboxes"),
            computeSeconds: sum("computeSeconds"),
            earnedMicros: sum("earnedMicros"),
            refundedMicros: sum("refundedMicros"),
            allowanceReturnedMicros: sum("allowanceReturnedMicros"),
            x402SpentMicros: sum("x402SpentMicros"),
            spentMicros: sum("spentMicros"),
        },
        daily,
        providers: zero
            ? []
            : names.map((provider, i) => ({
                  provider,
                  sandboxes7d: 20 + Math.floor(next() * 200),
                  active: i === 0 ? now0 : 0,
                  // The last provider has too few samples for a percentile
                  startP50Ms: i === names.length - 1 ? null : 1500 + Math.floor(next() * 1500),
                  startP95Ms: i === names.length - 1 ? null : 4000 + Math.floor(next() * 3000),
                  failed7d: Math.floor(next() * 6),
              })),
        payments: {
            byKind: zero
                ? []
                : [
                      { kind: "sandbox", count: 900, micros: hostile ? 10 ** 12 : 52_000_000 },
                      { kind: "extend", count: 120, micros: 4_000_000 },
                      { kind: "x402_allowance", count: 40, micros: 2_000_000 },
                      { kind: "x402_fee", count: 40, micros: 200_000 },
                  ],
            byMethod: zero
                ? []
                : [
                      { method: "checkout", count: 300, micros: 20_000_000 },
                      { method: "pay_cli", count: 600, micros: 32_000_000 },
                  ],
            refunds: { count: zero ? 0 : 12, micros: sum("refundedMicros") },
        },
        packages: [
            {
                id: "cpu-small-10m",
                vcpu: 2,
                memoryMiB: 2048,
                diskGiB: 10,
                gpu: null,
                minutes: 10,
                priceMicros: 50_000,
            },
            {
                id: "cpu-medium-30m",
                vcpu: 4,
                memoryMiB: 8192,
                diskGiB: 20,
                gpu: null,
                minutes: 30,
                priceMicros: 180_000,
            },
            {
                id: "cpu-large-10m",
                vcpu: 8,
                memoryMiB: 16_384,
                diskGiB: 40,
                gpu: null,
                minutes: 10,
                priceMicros: 200_000,
            },
            {
                id: "cpu-xlarge-30m",
                vcpu: 16,
                memoryMiB: 32_768,
                diskGiB: 80,
                gpu: null,
                minutes: 30,
                priceMicros: 1_200_000,
            },
            {
                id: "gpu-t4-10m",
                vcpu: 4,
                memoryMiB: 16_384,
                diskGiB: 40,
                gpu: { count: 1, memoryGiB: 20 },
                minutes: 10,
                priceMicros: 400_000,
            },
            {
                id: "gpu-small-30m",
                vcpu: 4,
                memoryMiB: 16_384,
                diskGiB: 50,
                gpu: { count: 1, memoryGiB: 20 },
                minutes: 30,
                priceMicros: 1_500_000,
            },
            {
                id: "gpu-l4-10m",
                vcpu: 8,
                memoryMiB: 32_768,
                diskGiB: 100,
                gpu: { count: 1, memoryGiB: 24 },
                minutes: 10,
                priceMicros: 800_000,
            },
            {
                id: "gpu-a100-10m",
                vcpu: 16,
                memoryMiB: 65_536,
                diskGiB: 200,
                gpu: { count: 1, memoryGiB: 80 },
                minutes: 10,
                priceMicros: 2_500_000,
            },
        ],
        servers: zero
            ? []
            : [
                  {
                      provider: names[0],
                      size: "small",
                      vcpu: 2,
                      memoryMiB: 4096,
                      diskGiB: 51,
                      gpu: null,
                      longestRunMinutes: 43_190,
                      user: "user",
                      available: true,
                      packages: [
                          { id: "cpu-small-10m", minutes: 10, priceMicros: 50_000 },
                          { id: "cpu-medium-30m", minutes: 30, priceMicros: 180_000 },
                      ],
                  },
                  {
                      provider: names[1],
                      size: "2x2",
                      vcpu: 2,
                      memoryMiB: 2048,
                      diskGiB: 10,
                      gpu: null,
                      longestRunMinutes: 50,
                      user: "root",
                      available: true,
                      packages: [{ id: "cpu-small-10m", minutes: 10, priceMicros: 52_442 }],
                  },
                  {
                      provider: names[2],
                      size: "l4",
                      vcpu: 8,
                      memoryMiB: 32_768,
                      diskGiB: 100,
                      gpu: { count: 1, memoryGiB: 24, model: "NVIDIA L4" },
                      longestRunMinutes: null,
                      user: "root",
                      available: false,
                      packages: [{ id: "gpu-l4-10m", minutes: 10, priceMicros: 800_000 }],
                  },
              ],
        limits: { "wallet.max_concurrent": 5, "wallet.starts_per_hour": 30, "other.key": 1 },
    };
}

function total(scenario: Scenario): number {
    if (scenario === "empty") return 0;
    return scenario === "one-day" ? 3 : 120;
}

/** The cursor is the offset of the next row, behind a prefix that makes it look opaque. */
function slice<T>(scenario: Scenario, before: string | undefined, row: (i: number) => T) {
    const start = before?.startsWith("c_") ? Number(before.slice(2)) || 0 : 0;
    const end = Math.min(start + PAGE_SIZE, total(scenario));
    const items = Array.from({ length: Math.max(0, end - start) }, (_, i) => row(start + i));
    return { items, next: end < total(scenario) ? `c_${end}` : null };
}

const pick = <T>(list: T[], i: number) => list[i % list.length] as T;

export function fakeSessions(seed: number, scenario: Scenario, before?: string): unknown {
    if (scenario === "down") return null;
    if (scenario === "bad-shape") return { items: "nope", next: null };
    const hostile = scenario === "hostile";
    return slice(scenario, before, (i) => {
        const next = rng(seed + i);
        const started = FIXED_NOW.getTime() - (i + 1) * 600_000;
        const seconds = Math.floor(next() * 900);
        const running = i === 0;
        const failed = i % 11 === 5;
        return {
            startedAt: isoSecond(started),
            endedAt: running ? null : isoSecond(started + seconds * 1000),
            provider: failed ? null : hostile && i % 3 === 0 ? hostileProvider : pick(providers, i),
            vcpu: i % 9 === 4 ? null : 2,
            memoryMiB: i % 9 === 4 ? null : 2048,
            gpu: i % 5 === 0 && i % 9 !== 4 ? { count: 1, memoryGiB: 20 } : null,
            seconds: failed ? 0 : seconds,
            commands: Math.floor(next() * 20),
            priceMicros: hostile ? 10 ** 12 : 50_000,
            status: running ? "running" : failed ? "failed" : "ended",
            endReason: running ? null : failed ? "no_capacity" : pick(["stop", "deadline"], i),
            // Wallets are null at first, as the router sends them until Payments adds fee_payer
            wallet: hostile && i === 1 ? badWallet : i % 2 ? pick(fakeWallets, i) : null,
            tx: hostile && i === 1 ? shortTx : i % 2 ? pick(fakeTxs, i) : null,
        };
    });
}

export function fakePayments(seed: number, scenario: Scenario, before?: string): unknown {
    if (scenario === "down") return null;
    if (scenario === "bad-shape") return { items: [{ kind: "nope" }], next: null };
    const hostile = scenario === "hostile";
    return slice(scenario, before, (i) => {
        const next = rng(seed + 7 + i);
        const kind = pick(["sandbox", "extend", "x402_allowance", "refund", "allowance_return"], i);
        const outgoing = kind === "refund" || kind === "allowance_return";
        return {
            at: isoSecond(FIXED_NOW.getTime() - (i + 1) * 420_000),
            kind,
            amountMicros: hostile ? 10 ** 12 : Math.round(next() * 200_000),
            ...(outgoing ? {} : { method: pick(["checkout", "pay_cli"], i) }),
            wallet: hostile && i === 1 ? badWallet : pick(fakeWallets, i),
            tx: hostile && i === 1 ? shortTx : pick(fakeTxs, i),
        };
    });
}
