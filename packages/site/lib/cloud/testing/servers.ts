import type { ServerRow } from "../../stats/types";

/** The servers production's feed sent on 2026-11-14, after router release 20261114-0112-e0ce937 */
export const productionServers: ServerRow[] = [
    {
        provider: "boat",
        size: "small",
        vcpu: 2,
        memoryMiB: 4096,
        diskGiB: 51,
        gpu: null,
        longestRunMinutes: 43190,
        user: "user",
        available: true,
        packages: [
            {
                id: "small-10m",
                minutes: 10,
                priceMicros: 50000,
            },
            {
                id: "medium-10m",
                minutes: 10,
                priceMicros: 80000,
            },
        ],
    },
    {
        provider: "boat",
        size: "default",
        vcpu: 4,
        memoryMiB: 8192,
        diskGiB: 51,
        gpu: null,
        longestRunMinutes: 43190,
        user: "user",
        available: true,
        packages: [
            {
                id: "large-10m",
                minutes: 10,
                priceMicros: 150000,
            },
        ],
    },
    {
        provider: "boat",
        size: "large",
        vcpu: 8,
        memoryMiB: 16384,
        diskGiB: 111,
        gpu: null,
        longestRunMinutes: 43190,
        user: "user",
        available: true,
        packages: [
            {
                id: "xlarge-10m",
                minutes: 10,
                priceMicros: 300000,
            },
        ],
    },
    {
        provider: "e2b",
        size: "2x2",
        vcpu: 2,
        memoryMiB: 2048,
        diskGiB: 10,
        gpu: null,
        longestRunMinutes: 50,
        user: "root",
        available: true,
        packages: [
            {
                id: "small-10m",
                minutes: 10,
                priceMicros: 50000,
            },
        ],
    },
    {
        provider: "e2b",
        size: "4x8",
        vcpu: 4,
        memoryMiB: 8192,
        diskGiB: 10,
        gpu: null,
        longestRunMinutes: 50,
        user: "root",
        available: true,
        packages: [
            {
                id: "large-10m",
                minutes: 10,
                priceMicros: 150000,
            },
        ],
    },
    {
        provider: "boxd",
        size: "2x8",
        vcpu: 2,
        memoryMiB: 8192,
        diskGiB: 100,
        gpu: null,
        longestRunMinutes: null,
        user: "boxd",
        available: true,
        packages: [
            {
                id: "medium-10m",
                minutes: 10,
                priceMicros: 80000,
            },
        ],
    },
    {
        provider: "boxd",
        size: "4x16",
        vcpu: 4,
        memoryMiB: 16384,
        diskGiB: 100,
        gpu: null,
        longestRunMinutes: null,
        user: "boxd",
        available: true,
        packages: [
            {
                id: "large-10m",
                minutes: 10,
                priceMicros: 150000,
            },
        ],
    },
    {
        provider: "boxd",
        size: "8x32",
        vcpu: 8,
        memoryMiB: 32768,
        diskGiB: 100,
        gpu: null,
        longestRunMinutes: null,
        user: "boxd",
        available: true,
        packages: [
            {
                id: "xlarge-10m",
                minutes: 10,
                priceMicros: 300000,
            },
        ],
    },
];
