// The corruptions poke at arbitrary JSON paths, so the test treats the feed as untyped
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { parsePayments, parseSessions, parseSummary } from "./parse";
import {
    badWallet,
    fakePayments,
    fakeSessions,
    fakeSummary,
    fakeTxs,
    fakeWallets,
    shortTx,
} from "./testing/fake-data";

const summary = () => structuredClone(fakeSummary(1, "normal")) as Record<string, any>;
const sessions = () => structuredClone(fakeSessions(1, "normal")) as Record<string, any>;

describe("parseSummary", () => {
    it("parses every scenario that is well formed", () => {
        for (const s of ["normal", "empty", "one-day", "hostile"] as const) {
            expect(parseSummary(fakeSummary(1, s)), s).not.toBeNull();
        }
        expect(parseSummary(fakeSummary(1, "bad-shape"))).toBeNull();
    });

    it("ignores unknown fields and drops unknown limit keys", () => {
        const json = summary();
        json.extra = 1;
        json.daily[0].extra = 1;
        const parsed = parseSummary(json);
        expect(parsed?.limits).toEqual({
            "wallet.max_concurrent": 5,
            "wallet.starts_per_hour": 30,
        });
    });

    it.each([
        ["wrong version", (j: any) => (j.version = 2)],
        ["missing field", (j: any) => delete j.totals.spentMicros],
        ["wrong type", (j: any) => (j.now.active = "3")],
        ["negative count", (j: any) => (j.daily[0].sandboxes = -1)],
        ["fractional micros", (j: any) => (j.totals.earnedMicros = 1.5)],
        ["unsafe micros", (j: any) => (j.totals.earnedMicros = 2 ** 60)],
        ["unknown payment kind", (j: any) => (j.payments.byKind[0].kind = "gift")],
        ["bad day", (j: any) => (j.daily[0].day = "yesterday")],
        ["bad limit value", (j: any) => (j.limits["wallet.max_concurrent"] = "5")],
        ["servers that are not a list", (j: any) => (j.servers = null)],
        ["a server's availability as a string", (j: any) => (j.servers[0].available = "true")],
        ["a server missing its user", (j: any) => delete j.servers[0].user],
        ["a fractional server price", (j: any) => (j.servers[0].packages[0].priceMicros = 1.5)],
        ["a negative longest run", (j: any) => (j.servers[0].longestRunMinutes = -5)],
    ])("returns null for %s", (_, corrupt) => {
        const json = summary();
        corrupt(json);
        expect(parseSummary(json)).toBeNull();
    });

    it("returns null for non-objects", () => {
        for (const v of [null, 1, "x", [], undefined]) expect(parseSummary(v)).toBeNull();
    });

    it("keeps null percentiles", () => {
        expect(parseSummary(summary())?.providers.at(-1)?.startP50Ms).toBeNull();
    });

    it("reads each server with the packages that land on it, at its own price", () => {
        const servers = parseSummary(summary())?.servers ?? [];
        expect(servers.map((s) => `${s.provider} ${s.size}`)).toEqual([
            "boat small",
            "e2b 2x2",
            "koyeb l4",
        ]);
        expect(servers[1]).toEqual({
            provider: "e2b",
            size: "2x2",
            vcpu: 2,
            memoryMiB: 2048,
            diskGiB: 10,
            gpu: null,
            longestRunMinutes: 50,
            user: "root",
            available: true,
            packages: [{ id: "cpu-small-10m", minutes: 10, priceMicros: 52_442 }],
        });
        expect(servers[2]).toMatchObject({
            gpu: { count: 1, memoryGiB: 24, model: "NVIDIA L4" },
            longestRunMinutes: null,
            available: false,
        });
    });

    it("reads a feed from before servers as one with none", () => {
        const json = summary();
        delete json.servers;
        expect(parseSummary(json)?.servers).toEqual([]);
        expect(parseSummary(fakeSummary(1, "empty"))?.servers).toEqual([]);
    });

    it("drops a server package's unknown fields and a GPU's blank model", () => {
        const json = summary();
        json.servers[0].packages[0].costMicros = 1;
        json.servers[2].gpu.model = " ";
        const servers = parseSummary(json)?.servers ?? [];
        expect(servers[0]?.packages[0]).toEqual({
            id: "cpu-small-10m",
            minutes: 10,
            priceMicros: 50_000,
        });
        expect(servers[2]?.gpu?.model).toBeNull();
    });
});

describe("parseSessions", () => {
    it("keeps nullable fields as null and a good wallet and tx", () => {
        const rows = parseSessions(sessions())?.items ?? [];
        expect(rows[0]?.endedAt).toBeNull();
        expect(rows[0]?.endReason).toBeNull();
        expect(rows.some((r) => r.provider === null)).toBe(true);
        expect(rows.some((r) => r.vcpu === null && r.gpu === null)).toBe(true);
        expect(fakeWallets).toContain(rows.find((r) => r.wallet)?.wallet);
        expect(fakeTxs).toContain(rows.find((r) => r.tx)?.tx);
    });

    it("nulls a bad wallet or tx but keeps the row", () => {
        const json = sessions();
        json.items[2].wallet = badWallet;
        json.items[2].tx = shortTx;
        const row = parseSessions(json)?.items[2];
        expect(row).toMatchObject({ wallet: null, tx: null, status: "ended" });
    });

    it("maps an unknown end reason to other, and refuses a wrong status", () => {
        const json = sessions();
        json.items[1].endReason = "brand_new";
        expect(parseSessions(json)?.items[1]?.endReason).toBe("other");
        json.items[1].status = "paused";
        expect(parseSessions(json)).toBeNull();
    });

    it("returns null for a bad page", () => {
        expect(parseSessions({ items: "x", next: null })).toBeNull();
        expect(parseSessions({ items: [], next: 4 })).toBeNull();
        expect(parseSessions(fakeSessions(1, "bad-shape"))).toBeNull();
    });
});

describe("parsePayments", () => {
    it("treats a missing method as null and checks the kind", () => {
        const page = parsePayments(fakePayments(1, "normal"));
        expect(page?.items.find((r) => r.kind === "refund")?.method).toBeNull();
        expect(page?.next).toBe("c_50");
        expect(parsePayments(fakePayments(1, "bad-shape"))).toBeNull();
    });
});
