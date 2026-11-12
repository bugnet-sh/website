import { describe, expect, it } from "vitest";
import {
    alignedDecimals,
    formatDuration,
    formatShortWallet,
    formatUsdc,
    profit,
    usdcDecimals,
} from "./format";

describe("formatUsdc", () => {
    it("writes an amount exact to the micro, in the decimals it needs and at least two", () => {
        expect(formatUsdc(50_000)).toBe("0.05");
        expect(formatUsdc(25_000)).toBe("0.025");
        expect(formatUsdc(52_442)).toBe("0.052442");
        expect(formatUsdc(100_000)).toBe("0.10");
        expect(formatUsdc(2_000_000)).toBe("2.00");
        expect(formatUsdc(0)).toBe("0.00");
        expect(formatUsdc(-400_000)).toBe("-0.40");
    });

    it("groups thousands and never rounds an amount", () => {
        expect(formatUsdc(1_234_567_890)).toBe("1,234.56789");
        expect(formatUsdc(10 ** 12)).toBe("1,000,000.00");
        expect(formatUsdc(10 ** 12 + 1)).toBe("1,000,000.000001");
    });

    it("honours decimals, rounds, and signs only a nonzero result", () => {
        expect(formatUsdc(1_500_000, { decimals: 0 })).toBe("2");
        expect(formatUsdc(-400_000, { decimals: 2 })).toBe("-0.40");
        expect(formatUsdc(-1, { decimals: 2 })).toBe("0.00");
        expect(formatUsdc(NaN)).toBe("0.00");
    });

    it("counts the decimals an amount needs, two at least", () => {
        expect([0, 50_000, 25_000, 52_442, -1, 2_000_000, NaN].map(usdcDecimals)).toEqual([
            2, 2, 3, 6, 6, 2, 2,
        ]);
    });

    it("gives a column the decimals its longest amount needs, so every amount stays exact", () => {
        expect(alignedDecimals([50_000, 80_000])).toBe(2);
        expect(alignedDecimals([50_000, 25_000, 2_000_000])).toBe(3);
        expect(alignedDecimals([50_000, 52_442])).toBe(6);
        expect(alignedDecimals([])).toBe(2);
        expect([50_000, 52_442].map((m) => formatUsdc(m, { decimals: 6 }))).toEqual([
            "0.050000",
            "0.052442",
        ]);
    });
});

describe("formatDuration", () => {
    it("reads seconds, minutes and hours", () => {
        expect(formatDuration(45)).toBe("45 s");
        expect(formatDuration(540)).toBe("9 min");
        expect(formatDuration(3600)).toBe("1 h");
        expect(formatDuration(3900)).toBe("1 h 5 min");
        expect(formatDuration(0)).toBe("0 s");
    });
});

it("shortens a wallet to 4 and 4", () => {
    expect(formatShortWallet("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")).toBe(
        "7xKX…AsU".replace("AsU", "gAsU"),
    );
});

it("leaves allowance returned and x402 spent out of profit", () => {
    const day = { earnedMicros: 100, refundedMicros: 10, spentMicros: 120 };
    expect(profit({ ...day, allowanceReturnedMicros: 5, x402SpentMicros: 9 } as typeof day)).toBe(
        -30,
    );
});
