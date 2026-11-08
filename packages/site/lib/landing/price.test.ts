import { describe, expect, it } from "vitest";
import { packageFacts, perMinuteText, priceText, pricingPackages } from "./price";
import type { PackageRow } from "../stats/types";

it("shows a price with the decimals it needs and at least two", () => {
    expect(priceText(50_000)).toBe("0.05");
    expect(priceText(25_000)).toBe("0.025");
    expect(priceText(2_000_000)).toBe("2.00");
});

it("lists a package's parts, with a GPU row only when it has a GPU", () => {
    const cpu = { id: "c", vcpu: 2, memoryMiB: 2048, diskGiB: 10, gpu: null, minutes: 10 };
    expect(packageFacts({ ...cpu, priceMicros: 50_000 })).toEqual([
        { label: "vCPU", value: "2" },
        { label: "Memory", value: "2 GiB" },
        { label: "Disk", value: "10 GiB" },
        { label: "Length", value: "10 min" },
    ]);
    const gpu = { ...cpu, memoryMiB: 1536, gpu: { count: 1, memoryGiB: 20 }, minutes: 90 };
    expect(packageFacts({ ...gpu, priceMicros: 400_000 })).toEqual([
        { label: "vCPU", value: "2" },
        { label: "Memory", value: "1.5 GiB" },
        { label: "Disk", value: "10 GiB" },
        { label: "GPU", value: "1 × 20 GiB" },
        { label: "Length", value: "1 h 30 min" },
    ]);
});

it("shows the rate per minute, rounded to the micro-USDC", () => {
    expect(perMinuteText({ priceMicros: 50_000, minutes: 10 })).toBe("0.005");
    expect(perMinuteText({ priceMicros: 1_500_000, minutes: 30 })).toBe("0.05");
    expect(perMinuteText({ priceMicros: 200_000, minutes: 30 })).toBe("0.006667");
});

describe("pricingPackages", () => {
    const pack = (id: string, priceMicros: number, gpu = false): PackageRow => ({
        id,
        vcpu: 2,
        memoryMiB: 2048,
        diskGiB: 10,
        gpu: gpu ? { count: 1, memoryGiB: 24 } : null,
        minutes: 10,
        priceMicros,
    });
    const ids = (rows: PackageRow[]) => rows.map((p) => p.id);

    it("lists CPU packages then GPU packages, each from the lowest rate up", () => {
        const rows = [
            pack("g2", 900, true),
            pack("c2", 200),
            pack("g1", 500, true),
            pack("c1", 100),
        ];
        expect(ids(pricingPackages(rows))).toEqual(["c1", "c2", "g1", "g2"]);
    });

    it("keeps at most eight, half of them GPUs when both kinds overflow", () => {
        const cpu = Array.from({ length: 10 }, (_, i) => pack(`c${i}`, 100 + i));
        const gpu = Array.from({ length: 10 }, (_, i) => pack(`g${i}`, 1000 + i, true));
        expect(ids(pricingPackages([...gpu, ...cpu]))).toEqual([
            "c0",
            "c1",
            "c2",
            "c3",
            "g0",
            "g1",
            "g2",
            "g3",
        ]);
    });

    it("gives the spare places to the kind that has more", () => {
        const cpu = Array.from({ length: 10 }, (_, i) => pack(`c${i}`, 100 + i));
        expect(pricingPackages([...cpu, pack("g0", 900, true)])).toHaveLength(8);
        expect(ids(pricingPackages([...cpu, pack("g0", 900, true)])).at(-1)).toBe("g0");
        const gpu = Array.from({ length: 10 }, (_, i) => pack(`g${i}`, 1000 + i, true));
        expect(ids(pricingPackages([pack("c0", 100), ...gpu]))).toEqual([
            "c0",
            "g0",
            "g1",
            "g2",
            "g3",
            "g4",
            "g5",
            "g6",
        ]);
    });
});
