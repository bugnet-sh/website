import { describe, expect, it } from "vitest";
import { catalogPackages } from "../landing/catalog";
import { providerLabel } from "../stats/labels";
import type { PackageRow } from "../stats/types";
import {
    activeFilters,
    cloudProviders,
    cloudServers,
    filterServers,
    longestRun,
    noFilters,
    packageCounts,
    providerCounts,
    runText,
    sizeFor,
    sortServers,
    type Server,
} from "./servers";

const servers = cloudServers(catalogPackages());
const names = (list: readonly Server[]) => list.map((s) => `${s.provider.id} ${s.size.name}`);

const pack = (id: string, vcpu: number, memoryMiB: number, diskGiB: number): PackageRow => ({
    id,
    vcpu,
    memoryMiB,
    diskGiB,
    gpu: null,
    minutes: 10,
    priceMicros: 50_000,
});

describe("the providers", () => {
    it("are named as each brand writes itself, as the stats page names them", () => {
        expect(cloudProviders.map((p) => p.name)).toEqual(["Boat", "E2B", "boxd"]);
        for (const p of cloudProviders) expect(providerLabel(p.id)).toBe(p.name);
    });

    it("run as long as whole packages fit, 5 minutes short of the provider's limit", () => {
        const run = (id: string) => runText(longestRun(servers.find((s) => s.id === id) as Server));
        expect(run("boat-small")).toBe("30 days");
        expect(run("e2b-2x2")).toBe("50 minutes");
        expect(run("boxd-2x8")).toBe("No limit");
    });
});

describe("sizeFor", () => {
    it("picks the first size in the provider's order that covers vCPU, memory and disk", () => {
        const [boat, e2b, boxd] = cloudProviders;
        const medium = pack("medium", 2, 4096, 40);
        expect(boat && sizeFor(boat, medium)?.name).toBe("small");
        // E2B's templates hold 10 GiB of disk
        expect(e2b && sizeFor(e2b, medium)).toBeNull();
        expect(boxd && sizeFor(boxd, medium)?.name).toBe("2x8");
    });

    it("never picks a size the provider won't start yet", () => {
        const boat = cloudProviders[0] as (typeof cloudProviders)[number];
        // Only Boat's large covers 8 vCPU, and Boat's trial holds it back
        expect(sizeFor(boat, pack("eight", 8, 16_384, 100))).toBeNull();
    });

    it("never picks a size for a GPU package", () => {
        const gpu = { ...pack("gpu", 2, 2048, 10), gpu: { count: 1, memoryGiB: 20 } };
        for (const p of cloudProviders) expect(sizeFor(p, gpu)).toBeNull();
    });
});

describe("cloudServers", () => {
    it("lists the seven sizes the catalog's packages land on, each with its packages", () => {
        expect(
            servers.map((s) => [`${s.provider.id} ${s.size.name}`, s.packages.map((p) => p.id)]),
        ).toEqual([
            ["boat small", ["small-10m", "medium-10m"]],
            ["boat default", ["large-10m"]],
            ["e2b 2x2", ["small-10m"]],
            ["e2b 4x8", ["large-10m"]],
            ["boxd 2x8", ["medium-10m"]],
            ["boxd 4x16", ["large-10m"]],
            ["boxd 8x32", ["xlarge-10m"]],
        ]);
    });

    it("leaves out a size no package picks, such as boxd's 1 vCPU", () => {
        expect(names(servers)).not.toContain("boxd 1x4");
    });

    it("leaves out a size the provider won't start yet, and lands its packages elsewhere", () => {
        expect(names(servers)).not.toContain("boat large");
        const xlarge = servers.filter((s) => s.packages.some((p) => p.id === "xlarge-10m"));
        expect(names(xlarge)).toEqual(["boxd 8x32"]);
    });

    it("leaves a package off a size the router refuses it on", () => {
        const boxd = servers.find((s) => s.id === "boxd-2x8");
        expect(boxd?.packages.map((p) => p.id)).not.toContain("small-10m");
    });

    it("lists a server's packages cheapest first, by price per minute", () => {
        const long = { ...pack("long", 2, 2048, 10), minutes: 60, priceMicros: 120_000 };
        const short = { ...pack("short", 2, 2048, 10), priceMicros: 50_000 };
        const [first] = cloudServers([short, long]);
        expect(first?.packages.map((p) => p.id)).toEqual(["long", "short"]);
    });
});

describe("filterServers", () => {
    it("keeps every server with no filter set", () => {
        expect(filterServers(servers, noFilters)).toHaveLength(7);
        expect(activeFilters(noFilters)).toBe(0);
    });

    it("matches the search to a provider, a size or a package, in any case", () => {
        const find = (query: string) => names(filterServers(servers, { ...noFilters, query }));
        expect(find("BOXD")).toEqual(["boxd 2x8", "boxd 4x16", "boxd 8x32"]);
        expect(find(" 4x8 ")).toEqual(["e2b 4x8"]);
        expect(find("xlarge")).toEqual(["boxd 8x32"]);
    });

    it("ORs within a group and ANDs across groups and the search", () => {
        const filters = { query: "", providers: ["e2b", "boxd"], packages: ["large-10m"] };
        expect(names(filterServers(servers, filters))).toEqual(["e2b 4x8", "boxd 4x16"]);
        expect(activeFilters(filters)).toBe(3);
        expect(filterServers(servers, { ...filters, query: "boat" })).toEqual([]);
    });

    it("counts the servers of each provider and each package", () => {
        expect(providerCounts(servers)).toEqual([
            { id: "boat", label: "Boat", count: 2 },
            { id: "e2b", label: "E2B", count: 2 },
            { id: "boxd", label: "boxd", count: 3 },
        ]);
        expect(packageCounts(servers).map((p) => `${p.id} ${p.count}`)).toEqual([
            "small-10m 2",
            "medium-10m 2",
            "large-10m 3",
            "xlarge-10m 1",
        ]);
    });
});

describe("sortServers", () => {
    it("puts the cheapest first by default, ties by the smaller machine", () => {
        expect(names(sortServers(servers, "price"))).toEqual([
            "e2b 2x2",
            "boat small",
            "boxd 2x8",
            "e2b 4x8",
            "boat default",
            "boxd 4x16",
            "boxd 8x32",
        ]);
    });

    it("sorts by disk, smallest first, and by provider name", () => {
        expect(names(sortServers(servers, "disk")).slice(0, 3)).toEqual([
            "e2b 2x2",
            "e2b 4x8",
            "boat small",
        ]);
        expect(sortServers(servers, "provider").map((s) => s.provider.name)).toEqual([
            "Boat",
            "Boat",
            "boxd",
            "boxd",
            "boxd",
            "E2B",
            "E2B",
        ]);
    });

    it("leaves the list it was given as it was", () => {
        const before = names(servers);
        sortServers(servers, "memory");
        expect(names(servers)).toEqual(before);
    });
});
