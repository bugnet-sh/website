import type { PackageRow } from "../stats/types";

/** One machine size a provider sells, under the provider's own name for it */
export type Size = { name: string; vcpu: number; memoryMiB: number; diskGiB: number };

export type CloudProvider = {
    /** The router's name, as the stats feed sends it */
    id: string;
    /** As the brand writes it: boxd stays lower case even at the start of a sentence */
    name: string;
    url: string;
    /** The longest a sandbox may live, or null when the provider sets no limit */
    lifetimeHours: number | null;
    /** The user commands run as */
    user: string;
    location: string;
    /** In the router's order: a package lands on the first size that covers it */
    sizes: readonly Size[];
};

/**
 * The providers production runs, in the router's order, with the sizes its adapters sell. A test
 * keeps every figure equal to the router's source when that repository sits beside this one. What
 * each size costs Bugnet stays out of this public repository.
 */
export const cloudProviders: readonly CloudProvider[] = [
    {
        id: "boat",
        name: "Boat",
        url: "https://boat.dev",
        lifetimeHours: 30 * 24,
        user: "user",
        // Boat picks the country; we can't choose it
        location: "Germany, Finland or France",
        sizes: [
            { name: "small", vcpu: 2, memoryMiB: 4096, diskGiB: 51 },
            { name: "default", vcpu: 4, memoryMiB: 8192, diskGiB: 51 },
            { name: "large", vcpu: 8, memoryMiB: 16_384, diskGiB: 111 },
            { name: "xlarge", vcpu: 16, memoryMiB: 32_768, diskGiB: 251 },
        ],
    },
    {
        id: "e2b",
        name: "E2B",
        url: "https://e2b.dev",
        lifetimeHours: 1,
        user: "root",
        // Production uses E2B's default domain, e2b.app, which is its US-West-1 region
        location: "United States",
        sizes: [
            { name: "2x2", vcpu: 2, memoryMiB: 2048, diskGiB: 10 },
            { name: "4x8", vcpu: 4, memoryMiB: 8192, diskGiB: 10 },
        ],
    },
    {
        id: "boxd",
        name: "boxd",
        url: "https://boxd.sh",
        lifetimeHours: null,
        user: "boxd",
        location: "Frankfurt, Germany",
        sizes: [
            { name: "1x4", vcpu: 1, memoryMiB: 4096, diskGiB: 100 },
            { name: "2x8", vcpu: 2, memoryMiB: 8192, diskGiB: 100 },
            { name: "4x16", vcpu: 4, memoryMiB: 16_384, diskGiB: 100 },
            { name: "8x32", vcpu: 8, memoryMiB: 32_768, diskGiB: 100 },
        ],
    },
];

/** "30 days", "1 hour", or "No limit" */
export function lifetimeText(hours: number | null): string {
    if (hours === null) return "No limit";
    if (hours >= 24 && hours % 24 === 0) {
        const days = hours / 24;
        return `${days} ${days === 1 ? "day" : "days"}`;
    }
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

/**
 * The size the router's SizeFor picks for a package: the first in the provider's order with
 * enough vCPU, memory and disk. None of these providers has a GPU.
 */
export function sizeFor(provider: CloudProvider, p: PackageRow): Size | null {
    if (p.gpu) return null;
    return (
        provider.sizes.find(
            (s) => s.vcpu >= p.vcpu && s.memoryMiB >= p.memoryMiB && s.diskGiB >= p.diskGiB,
        ) ?? null
    );
}

/** One provider's size, with the packages that land on it, cheapest first */
export type Server = {
    id: string;
    provider: CloudProvider;
    size: Size;
    packages: readonly PackageRow[];
};

const perMinute = (p: PackageRow) => p.priceMicros / Math.max(1, p.minutes);
const byRate = (a: PackageRow, b: PackageRow) => perMinute(a) - perMinute(b);

/** Every size at least one package lands on, provider by provider in the router's order */
export function cloudServers(
    packages: readonly PackageRow[],
    providers: readonly CloudProvider[] = cloudProviders,
): Server[] {
    return providers.flatMap((provider) =>
        provider.sizes.flatMap((size) => {
            const fits = packages.filter((p) => sizeFor(provider, p) === size).sort(byRate);
            return fits.length > 0
                ? [{ id: `${provider.id}-${size.name}`, provider, size, packages: fits }]
                : [];
        }),
    );
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
    const counts = new Map<string, Count & { p: PackageRow }>();
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

/** The price a server's card shows: its cheapest package's */
export const cheapest = (s: Server): PackageRow => s.packages[0] as PackageRow;

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
