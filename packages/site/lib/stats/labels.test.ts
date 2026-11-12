import { describe, expect, it } from "vitest";
import {
    failureRate,
    formatBytes,
    formatLimit,
    formatStartMs,
    limitRows,
    median,
    providerLabel,
    sizeText,
    statusText,
} from "./labels";

describe("labels", () => {
    it("names known providers and shows any other name as sent", () => {
        expect(providerLabel("e2b")).toBe("E2B");
        expect(providerLabel("<img src=x>")).toBe("<img src=x>");
    });

    it("words a session's status, failed ones as bad", () => {
        expect(statusText({ status: "running", endReason: null })).toEqual({
            text: "Running",
            bad: false,
        });
        expect(statusText({ status: "ended", endReason: "stopped_by_bugnet" })).toEqual({
            text: "Ended: stopped by Bugnet",
            bad: false,
        });
        expect(statusText({ status: "failed", endReason: "no_capacity" })).toEqual({
            text: "Failed: no capacity",
            bad: true,
        });
        expect(statusText({ status: "failed", endReason: null }).text).toBe("Failed");
    });

    it("sizes a machine, with its GPU when it has one, and nothing for a retired package", () => {
        expect(sizeText({ vcpu: 2, memoryMiB: 2048, gpu: null })).toBe("2 vCPU, 2 GiB");
        expect(sizeText({ vcpu: 4, memoryMiB: 16_384, gpu: { count: 1, memoryGiB: 20 } })).toBe(
            "4 vCPU, 16 GiB, 1 GPU 20 GiB",
        );
        expect(sizeText({ vcpu: null, memoryMiB: null, gpu: null })).toBe("");
    });

    it("formats each kind of limit", () => {
        expect(formatBytes(53_687_091_200)).toBe("50 GiB");
        expect(formatBytes(512 * 1024 * 1024)).toBe("512 MiB");
        expect(formatLimit("wallet.max_concurrent", 5)).toBe("5");
        expect(formatLimit("transfer.max_file_bytes", 1_073_741_824)).toBe("1 GiB");
        expect(formatLimit("order.max_micros", 100_000_000)).toBe("100.00 USDC");
        expect(formatLimit("x402.max_price_per_call_micros", 500_000)).toBe("0.50 USDC");
    });

    it("keeps only the limits sent, in the table's order", () => {
        const rows = limitRows({ "sandbox.max_secrets": 20, "wallet.max_concurrent": 5 });
        expect(rows.map((r) => r.key)).toEqual(["wallet.max_concurrent", "sandbox.max_secrets"]);
    });

    it("takes the median of the days that had sessions end", () => {
        expect(median([0, 300, 100, 0, 200])).toBe(200);
        expect(median([100, 0, 301])).toBe(200);
        expect(median([0, 0])).toBe(0);
    });

    it("shows a failure rate to one decimal, None at zero, and never above 100 %", () => {
        expect(failureRate({ failed7d: 0, sandboxes7d: 0 })).toBe("None");
        expect(failureRate({ failed7d: 1, sandboxes7d: 30 })).toBe("3.3 %");
        expect(failureRate({ failed7d: 3, sandboxes7d: 0 })).toBe("100.0 %");
    });

    it("shows start times in ms under a second, else in seconds", () => {
        expect(formatStartMs(850)).toBe("850 ms");
        expect(formatStartMs(2140)).toBe("2.1 s");
    });
});
