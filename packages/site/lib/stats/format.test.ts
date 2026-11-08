import { describe, expect, it } from "vitest";
import { formatDuration, formatShortWallet, formatUsdc, profit } from "./format";

describe("formatUsdc", () => {
    it("uses 2 decimals from one dollar and 3 below, with separators", () => {
        expect(formatUsdc(1_234_567_890)).toBe("1,234.57");
        expect(formatUsdc(50_000)).toBe("0.050");
        expect(formatUsdc(0)).toBe("0.000");
        expect(formatUsdc(10 ** 12)).toBe("1,000,000.00");
    });

    it("honours decimals, rounds, and signs only a nonzero result", () => {
        expect(formatUsdc(1_500_000, { decimals: 0 })).toBe("2");
        expect(formatUsdc(-400_000, { decimals: 2 })).toBe("-0.40");
        expect(formatUsdc(-1, { decimals: 2 })).toBe("0.00");
        expect(formatUsdc(NaN)).toBe("0.00");
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
