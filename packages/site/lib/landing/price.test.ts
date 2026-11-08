import { expect, it } from "vitest";
import { packageFacts, priceText } from "./price";

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
