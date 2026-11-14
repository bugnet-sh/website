import { describe, expect, it } from "vitest";
import { providerLabel } from "../stats/labels";
import type { ServerRow } from "../stats/types";
import {
    activeFilters,
    cloudProviders,
    cloudServers,
    filterServers,
    noFilters,
    packageCounts,
    providerCounts,
    runText,
    sortServers,
    type Server,
} from "./servers";
import { productionServers } from "./testing/servers";

const servers = cloudServers(productionServers);
const names = (list: readonly Server[]) => list.map((s) => `${s.provider.id} ${s.size.name}`);

const row = (over: Partial<ServerRow>): ServerRow => ({
    provider: "boat",
    size: "small",
    vcpu: 2,
    memoryMiB: 4096,
    diskGiB: 51,
    gpu: null,
    longestRunMinutes: 43_190,
    user: "user",
    available: true,
    packages: [{ id: "small-10m", minutes: 10, priceMicros: 50_000 }],
    ...over,
});

describe("the providers", () => {
    it("are named as each brand writes itself, as the stats page names them", () => {
        expect(cloudProviders.map((p) => p.name)).toEqual(["Boat", "E2B", "boxd"]);
        for (const p of cloudProviders) expect(providerLabel(p.id)).toBe(p.name);
    });

    it("keep only brand, site and location; no size, lifetime, user or cost", () => {
        for (const p of cloudProviders) {
            expect(Object.keys(p).sort()).toEqual(["id", "location", "name", "url"]);
        }
    });
});

describe("runText", () => {
    it("reads the feed's longest run in days, hours or minutes, or as no limit", () => {
        const run = (id: string) =>
            runText((servers.find((s) => s.id === id) as Server).longestRunMinutes);
        expect(run("boat-small")).toBe("30 days");
        expect(run("e2b-2x2")).toBe("50 minutes");
        expect(run("boxd-2x8")).toBe("No limit");
    });
});

describe("cloudServers", () => {
    it("lists the feed's servers in the router's order, each with its packages", () => {
        expect(
            servers.map((s) => [`${s.provider.id} ${s.size.name}`, s.packages.map((p) => p.id)]),
        ).toEqual([
            ["boat small", ["small-10m", "medium-10m"]],
            ["boat default", ["large-10m"]],
            ["boat large", ["xlarge-10m"]],
            ["e2b 2x2", ["small-10m"]],
            ["e2b 4x8", ["large-10m"]],
            ["boxd 2x8", ["medium-10m"]],
            ["boxd 4x16", ["large-10m"]],
            ["boxd 8x32", ["xlarge-10m"]],
        ]);
    });

    it("prices each package as the feed prices it on that server", () => {
        const two = cloudServers([
            row({ packages: [{ id: "small-10m", minutes: 10, priceMicros: 55_000 }] }),
            row({
                provider: "e2b",
                size: "2x2",
                packages: [{ id: "small-10m", minutes: 10, priceMicros: 52_442 }],
            }),
        ]);
        expect(two.map((s) => s.packages[0]?.priceMicros)).toEqual([55_000, 52_442]);
    });

    it("brings over the server's resources, run, user and availability", () => {
        const [s] = cloudServers([
            row({ available: false, longestRunMinutes: null, user: "root", diskGiB: 111 }),
        ]);
        expect(s?.available).toBe(false);
        expect(s?.longestRunMinutes).toBeNull();
        expect(s?.user).toBe("root");
        expect(s?.size).toEqual({ name: "small", vcpu: 2, memoryMiB: 4096, diskGiB: 111 });
        expect(s?.provider.location).toBe("Germany, Finland or France");
    });

    it("shows a provider the site has no entry for under the router's name, with no link", () => {
        const [s] = cloudServers([row({ provider: "lium", size: "h100" })]);
        expect(s?.provider).toEqual({
            id: "lium",
            name: "lium",
            url: null,
            location: "Not published",
        });
    });

    it("leaves out a server the feed sends with no package", () => {
        expect(cloudServers([row({ packages: [] })])).toEqual([]);
    });

    it("lists a server's packages cheapest first, by price per minute", () => {
        const [first] = cloudServers([
            row({
                packages: [
                    { id: "short", minutes: 10, priceMicros: 50_000 },
                    { id: "long", minutes: 60, priceMicros: 120_000 },
                ],
            }),
        ]);
        expect(first?.packages.map((p) => p.id)).toEqual(["long", "short"]);
    });
});

describe("filterServers", () => {
    it("keeps every server with no filter set", () => {
        expect(filterServers(servers, noFilters)).toHaveLength(8);
        expect(activeFilters(noFilters)).toBe(0);
    });

    it("matches the search to a provider, a size or a package, in any case", () => {
        const find = (query: string) => names(filterServers(servers, { ...noFilters, query }));
        expect(find("BOXD")).toEqual(["boxd 2x8", "boxd 4x16", "boxd 8x32"]);
        expect(find(" 4x8 ")).toEqual(["e2b 4x8"]);
        expect(find("xlarge")).toEqual(["boat large", "boxd 8x32"]);
    });

    it("ORs within a group and ANDs across groups and the search", () => {
        const filters = { query: "", providers: ["e2b", "boxd"], packages: ["large-10m"] };
        expect(names(filterServers(servers, filters))).toEqual(["e2b 4x8", "boxd 4x16"]);
        expect(activeFilters(filters)).toBe(3);
        expect(filterServers(servers, { ...filters, query: "boat" })).toEqual([]);
    });

    it("counts the servers of each provider and each package", () => {
        expect(providerCounts(servers)).toEqual([
            { id: "boat", label: "Boat", count: 3 },
            { id: "e2b", label: "E2B", count: 2 },
            { id: "boxd", label: "boxd", count: 3 },
        ]);
        expect(packageCounts(servers).map((p) => `${p.id} ${p.count}`)).toEqual([
            "small-10m 2",
            "medium-10m 2",
            "large-10m 3",
            "xlarge-10m 2",
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
            "boat large",
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
