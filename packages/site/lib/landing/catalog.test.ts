import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { catalogPackages } from "./catalog";

const copy = join(__dirname, "../../content/catalog.json");
// The router's repository, when it is checked out beside this one
const router = join(__dirname, "../../../../../bugnet-router/config/packages.json");

it.runIf(existsSync(router))("keeps the copy equal to the router's production catalog", () => {
    expect(readFileSync(copy, "utf8")).toBe(readFileSync(router, "utf8"));
});

it("reads the copy as the feed serves packages, with no extension on its own", () => {
    const rows = catalogPackages();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.find((p) => p.id === "small-10m")).toEqual({
        id: "small-10m",
        vcpu: 2,
        memoryMiB: 2048,
        diskGiB: 10,
        gpu: null,
        minutes: 10,
        priceMicros: 50_000,
    });
    const more = catalogPackages({
        packages: [
            {
                id: "a",
                resources: {
                    vcpu: 1,
                    memory_mib: 1024,
                    disk_gib: 5,
                    gpu_count: 0,
                    gpu_memory_gib: 0,
                },
                minutes: 10,
                price_micros: 1,
            },
            {
                id: "a-more",
                resources: {
                    vcpu: 1,
                    memory_mib: 1024,
                    disk_gib: 5,
                    gpu_count: 0,
                    gpu_memory_gib: 0,
                },
                minutes: 10,
                price_micros: 1,
                extension_of: "a",
            },
            {
                id: "g",
                resources: {
                    vcpu: 6,
                    memory_mib: 45056,
                    disk_gib: 240,
                    gpu_count: 1,
                    gpu_memory_gib: 20,
                    gpu_model: "NVIDIA RTX 4000 SFF Ada",
                },
                minutes: 10,
                price_micros: 250_000,
            },
        ],
    });
    expect(more.map((p) => p.id)).toEqual(["a", "g"]);
    expect(more[1]?.gpu).toEqual({ count: 1, memoryGiB: 20, model: "NVIDIA RTX 4000 SFF Ada" });
});
