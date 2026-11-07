import { describe, expect, it } from "vitest";
import { isTx, isWallet } from "./base58";
import { encodeBase58 } from "./testing/fake-data";

const wallet = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const tx =
    "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW";

describe("base58 sizes", () => {
    it("accepts known-good 32 and 64 byte values", () => {
        expect(isWallet(wallet)).toBe(true);
        expect(isTx(tx)).toBe(true);
        expect(isWallet(tx)).toBe(false);
        expect(isTx(wallet)).toBe(false);
    });

    it("refuses 63 bytes, bad characters, empty and too long", () => {
        expect(isTx(encodeBase58(new Uint8Array(63).fill(9)))).toBe(false);
        expect(isWallet("0OIl")).toBe(false);
        expect(isWallet("")).toBe(false);
        expect(isTx("1".repeat(89))).toBe(false);
    });

    it("passes a 64 byte value that encodes to 87 characters", () => {
        // A high first byte makes the longest encoding; a low one makes a shorter one
        const bytes = new Uint8Array(64).fill(1);
        bytes[0] = 0x01;
        const short = encodeBase58(bytes);
        expect(short.length).toBeLessThan(88);
        expect(isTx(short)).toBe(true);
        expect(isTx(encodeBase58(new Uint8Array(64).fill(255)))).toBe(true);
    });

    it("counts leading ones as zero bytes", () => {
        expect(isWallet("1".repeat(32))).toBe(true);
        expect(isWallet("1".repeat(31))).toBe(false);
    });
});
