import { byRate } from "../landing/price";
import type { Gpu, ServerPackage, ServerRow } from "../stats/types";

/**
 * What the site keeps about a provider: its brand, its site and where its machines run. Every
 * other figure on /cloud comes from the router's live feed (founder D13, 2026-11-13).
 */
export type CloudProvider = {
    /** The router's name, as the stats feed sends it */
    id: string;
    /** As the brand writes it: boxd stays lower case even at the start of a sentence */
    name: string;
    url: string | null;
    location: string;
};

export const cloudProviders: readonly CloudProvider[] = [
    {
        id: "boat",
        name: "Boat",
        url: "https://boat.dev",
        // Boat picks the country; we can't choose it
        location: "Germany, Finland or France",
    },
    {
        id: "e2b",
        name: "E2B",
        url: "https://e2b.dev",
        // Production uses E2B's default domain, e2b.app, which is its US-West-1 region
        location: "United States",
    },
    { id: "boxd", name: "boxd", url: "https://boxd.sh", location: "Frankfurt, Germany" },
];

/** A provider the site has no entry for yet still shows, under the router's name for it */
const unknownProvider = (id: string): CloudProvider => ({
    id,
    name: id,
    url: null,
    location: "Not published",
});

/** One provider's machine size as the router places packages on it now, cheapest package first */
export type Server = {
    id: string;
    provider: CloudProvider;
    size: { name: string; vcpu: number; memoryMiB: number; diskGiB: number };
    gpu: Gpu | null;
    /** The most minutes a sandbox runs here, extended a package at a time, or null for no limit */
    longestRunMinutes: number | null;
    user: string;
    /** False while the provider is blocked or down, or would refuse a start now */
    available: boolean;
    packages: readonly ServerPackage[];
};

/** The feed's servers, in the router's order, each with its packages at their price there */
export function cloudServers(
    rows: readonly ServerRow[],
    providers: readonly CloudProvider[] = cloudProviders,
): Server[] {
    return rows
        .filter((r) => r.packages.length > 0)
        .map((r) => ({
            id: `${r.provider}-${r.size}`,
            provider: providers.find((p) => p.id === r.provider) ?? unknownProvider(r.provider),
            size: { name: r.size, vcpu: r.vcpu, memoryMiB: r.memoryMiB, diskGiB: r.diskGiB },
            gpu: r.gpu,
            longestRunMinutes: r.longestRunMinutes,
            user: r.user,
            available: r.available,
            packages: [...r.packages].sort(byRate),
        }));
}

/** "50 minutes", "30 days", or "No limit"; a run some minutes short of whole days reads as days */
export function runText(minutes: number | null): string {
    if (minutes === null) return "No limit";
    const count = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
    if (minutes >= 24 * 60) return count(Math.round(minutes / (24 * 60)), "day");
    if (minutes >= 60 && minutes % 60 === 0) return count(minutes / 60, "hour");
    return count(minutes, "minute");
}

export type Filters = {
    query: string;
    providers: readonly string[];
    packages: readonly string[];
};

export const noFilters: Filters = { query: "", providers: [], packages: [] };

/** How many filters are set, the search counting as one */
export const activeFilters = (f: Filters): number =>
    f.providers.length + f.packages.length + (f.query.trim() ? 1 : 0);

/** Any of the ticked providers, and any of the ticked packages, and the search */
export function filterServers(servers: readonly Server[], f: Filters): Server[] {
    const query = f.query.trim().toLowerCase();
    return servers.filter(
        (s) =>
            (f.providers.length === 0 || f.providers.includes(s.provider.id)) &&
            (f.packages.length === 0 || s.packages.some((p) => f.packages.includes(p.id))) &&
            (query === "" ||
                [s.provider.name, s.size.name, ...s.packages.map((p) => p.id)].some((word) =>
                    word.toLowerCase().includes(query),
                )),
    );
}

export type Count = { id: string; label: string; count: number };

export function providerCounts(servers: readonly Server[]): Count[] {
    const counts = new Map<string, Count>();
    for (const s of servers) {
        const c = counts.get(s.provider.id);
        if (c) c.count++;
        else counts.set(s.provider.id, { id: s.provider.id, label: s.provider.name, count: 1 });
    }
    return [...counts.values()];
}

/** Each package by how many servers it lands on, cheapest package first */
export function packageCounts(servers: readonly Server[]): Count[] {
    const counts = new Map<string, Count & { p: ServerPackage }>();
    for (const s of servers) {
        for (const p of s.packages) {
            const c = counts.get(p.id);
            if (c) c.count++;
            else counts.set(p.id, { id: p.id, label: p.id, count: 1, p });
        }
    }
    return [...counts.values()]
        .sort((a, b) => byRate(a.p, b.p))
        .map(({ id, label, count }) => ({ id, label, count }));
}

export const sortKeys = [
    { value: "price", label: "Price" },
    { value: "cpu", label: "CPU" },
    { value: "memory", label: "Memory" },
    { value: "disk", label: "Disk" },
    { value: "provider", label: "Provider" },
] as const;

export type SortKey = (typeof sortKeys)[number]["value"];

/** A server's cheapest package by the minute, which the Price sort goes by */
export const cheapest = (s: Server): ServerPackage => s.packages[0] as ServerPackage;

type Compare = (a: Server, b: Server) => number;
const byPrice: Compare = (a, b) => byRate(cheapest(a), cheapest(b));
const byCpu: Compare = (a, b) => a.size.vcpu - b.size.vcpu;
const byMemory: Compare = (a, b) => a.size.memoryMiB - b.size.memoryMiB;
const byDisk: Compare = (a, b) => a.size.diskGiB - b.size.diskGiB;
const byProvider: Compare = (a, b) =>
    a.provider.name.localeCompare(b.provider.name, "en", { sensitivity: "base" });

const first: Record<SortKey, Compare> = {
    price: byPrice,
    cpu: byCpu,
    memory: byMemory,
    disk: byDisk,
    provider: byProvider,
};

/**
 * Smallest first by the chosen key, then by price and the smaller machine. The sort is stable,
 * so servers still tied keep the router's provider order.
 */
export function sortServers(servers: readonly Server[], key: SortKey): Server[] {
    const order = [first[key], byPrice, byCpu, byMemory, byDisk];
    return [...servers].sort((a, b) => {
        for (const compare of order) {
            const d = compare(a, b);
            if (d !== 0) return d;
        }
        return 0;
    });
}
