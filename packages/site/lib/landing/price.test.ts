import { describe, expect, it } from "vitest";
import { packageFacts, pricingCells, SOON_GPUS, lengthText, type PricingCell } from "./price";
import type { PackageRow } from "../stats/types";

it("lists a package's parts, a GPU's model and VRAM first when it has one, its length last", () => {
    const cpu = { id: "c", vcpu: 2, memoryMiB: 2048, diskGiB: 10, gpu: null, minutes: 10 };
    expect(packageFacts({ ...cpu, priceMicros: 50_000 })).toEqual([
        { label: "vCPU", value: "2" },
        { label: "Memory", value: "2 GiB" },
        { label: "Disk", value: "10 GiB" },
    ]);
    const l4 = { count: 1, memoryGiB: 24, model: "NVIDIA L4" };
    const gpu = { ...cpu, memoryMiB: 1536, gpu: l4, minutes: 90, priceMicros: 400_000 };
    expect(packageFacts(gpu)).toEqual([
        { label: "GPU", value: "NVIDIA L4" },
        { label: "VRAM", value: "24 GiB" },
        { label: "vCPU", value: "2" },
        { label: "Memory", value: "1.5 GiB" },
        { label: "Disk", value: "10 GiB" },
    ]);
    const two = { ...cpu, gpu: { ...l4, count: 2 }, priceMicros: 1 };
    expect(packageFacts(two).slice(0, 2)).toEqual([
        { label: "GPU", value: "2 × NVIDIA L4" },
        { label: "VRAM", value: "2 × 24 GiB" },
    ]);
});

it("counts a GPU the feed names no model for, never showing a bare number", () => {
    const base = { id: "g", vcpu: 2, memoryMiB: 2048, diskGiB: 10, minutes: 10, priceMicros: 1 };
    const one = { ...base, gpu: { count: 1, memoryGiB: 24, model: null } };
    expect(packageFacts(one)[0]).toEqual({ label: "GPU", value: "1 GPU" });
    const two = { ...base, gpu: { count: 2, memoryGiB: 24 } };
    expect(packageFacts(two).slice(0, 2)).toEqual([
        { label: "GPU", value: "2 GPUs" },
        { label: "VRAM", value: "2 × 24 GiB" },
    ]);
});

it("says what a package's price buys", () => {
    expect(lengthText({ minutes: 10 })).toBe("/ 10 min");
    expect(lengthText({ minutes: 90 })).toBe("/ 1 h 30 min");
});

describe("pricingCells", () => {
    const pack = (id: string, priceMicros: number, model?: string): PackageRow => ({
        id,
        vcpu: 2,
        memoryMiB: 2048,
        diskGiB: 10,
        gpu: model ? { count: 1, memoryGiB: 20, model } : null,
        minutes: 10,
        priceMicros,
    });
    const names = (cells: PricingCell[]) =>
        cells.map((c) => (c.kind === "package" ? c.p.id : `soon:${c.model}`));

    it("lists CPU packages from the lowest rate up, then fills with GPUs coming soon", () => {
        expect(names(pricingCells([pack("c2", 200), pack("c1", 100)]))).toEqual([
            "c1",
            "c2",
            ...SOON_GPUS.map((g) => `soon:${g.model}`),
        ]);
    });

    it("keeps at most six CPU packages and eight cells, two of them GPUs", () => {
        const cpu = Array.from({ length: 10 }, (_, i) => pack(`c${i}`, 100 + i));
        const cells = pricingCells(cpu);
        expect(cells).toHaveLength(8);
        expect(names(cells).slice(0, 6)).toEqual(["c0", "c1", "c2", "c3", "c4", "c5"]);
        expect(names(cells).slice(6)).toEqual(["soon:NVIDIA H100", "soon:NVIDIA A100"]);
    });

    it("puts GPUs on sale before those coming soon, and never shows one twice", () => {
        const rows = [pack("c1", 100), pack("g1", 900, "NVIDIA L4"), pack("g0", 500, "RTX 4000")];
        expect(names(pricingCells(rows))).toEqual([
            "c1",
            "g0",
            "g1",
            "soon:NVIDIA H100",
            "soon:NVIDIA A100",
            "soon:NVIDIA L40S",
        ]);
    });

    it("shows no prices for GPUs coming soon", () => {
        const soon = pricingCells([]).filter((c) => c.kind === "soon");
        expect(soon).toHaveLength(4);
        for (const cell of soon) expect(cell).not.toHaveProperty("priceMicros");
    });
});
