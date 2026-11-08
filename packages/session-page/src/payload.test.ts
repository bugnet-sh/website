import { describe, expect, it } from "vitest";
import { isSignature, parseGetBody, PayloadError, type SessionRecord } from "./payload.ts";
import { base58, makeScenarios, sampleTx } from "./testing/fixtures.ts";

const sig = sampleTx("payload-test");

// The record example of session-page.md 7.3.1, field for field
function exampleRecord(): Record<string, unknown> {
    return {
        v: 1,
        startedAt: "2026-11-06T10:00:00Z",
        endedAt: "2026-11-06T10:10:00Z",
        endedBecause: "deadline",
        deletesAt: "2026-11-08T10:10:00Z",
        output: "complete",
        events: [
            {
                at: "2026-11-06T10:00:01Z",
                kind: "placement",
                phase: "placed",
                packageId: "dev-small-10m",
                vcpu: 2,
                memoryMib: 2048,
                diskGib: 10,
                minutes: 10,
            },
        ],
        eventsDropped: 0,
        jobs: [
            {
                seq: 1,
                command: "npm test",
                state: "exited",
                startedAt: "2026-11-06T10:01:00Z",
                finishedAt: "2026-11-06T10:02:00Z",
                exitCode: 0,
                oom: false,
                peakMib: 512,
                cutBytes: 0,
                frames: [{ s: "o", t: "ok 12 tests\n", cr: false }],
            },
        ],
    };
}

function exampleSnapshot(): Record<string, unknown> {
    return {
        v: 1,
        startedAt: "2026-11-06T10:00:00Z",
        deadline: "2026-11-06T10:10:00Z",
        now: "2026-11-06T10:03:00Z",
        jobs: [
            {
                seq: 1,
                command: "npm test",
                state: "running",
                startedAt: "2026-11-06T10:01:00Z",
                outBytes: 2048,
                errBytes: 0,
            },
        ],
    };
}

function ended(record: Record<string, unknown>): SessionRecord {
    const body = parseGetBody({ state: "ended", record });
    if (body.state !== "ended") throw new Error(`expected ended, got ${body.state}`);
    return body.record;
}

function withEvents(...events: unknown[]): Record<string, unknown> {
    return { ...exampleRecord(), events };
}

const at = "2026-11-06T10:05:00Z";
const network = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

// A paid call as the router serves it, with every key of 7.3.1's x402 row
function servedCall(fields: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        at,
        kind: "x402",
        host: "pay.example",
        method: "POST",
        path: "/v1/search",
        status: "paid",
        reason: "",
        count: 1,
        askedMicros: 3_000,
        amountMicros: 3_000,
        asset: "USDC",
        network,
        httpStatus: 200,
        durationMs: 1_840,
        bytesOut: 412,
        bytesIn: 18_204,
        streamCut: false,
        allowanceLeftMicros: 997_000,
        resolved: "paid",
        tx: sig,
        ...fields,
    };
}

function servedAllowance(fields: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        at,
        kind: "allowance",
        phase: "paid",
        amountMicros: 1_000_000,
        asset: "USDC",
        network,
        tx: sig,
        ...fields,
    };
}

describe("parseGetBody with the sample scenarios", () => {
    const scenarios = makeScenarios(new Date("2026-11-06T12:00:00Z"));
    const expected: Record<string, string> = {
        running: "running",
        expired: "expired",
        "too-new": "too-new",
    };

    it("parses every scenario's wire body", () => {
        for (const scenario of Object.values(scenarios)) {
            for (const answer of scenario.gets) {
                if (answer.body === null) continue;
                const body = parseGetBody(answer.body);
                expect(body.state, scenario.kind).toBe(expected[scenario.kind] ?? "ended");
            }
        }
    });

    it("drops no event of any scenario, so every sample event is well formed", () => {
        for (const scenario of Object.values(scenarios)) {
            for (const answer of scenario.gets) {
                const wire = answer.body as { state: string; record?: { events: unknown[] } };
                if (wire?.state !== "ended" || scenario.kind === "too-new") continue;
                const body = parseGetBody(wire);
                if (body.state !== "ended") throw new Error(scenario.kind);
                expect(body.record.events, scenario.kind).toHaveLength(wire.record!.events.length);
            }
        }
    });

    it("has every event kind and every kind of job in ended-full", () => {
        const body = parseGetBody(scenarios["ended-full"].gets[0]!.body);
        if (body.state !== "ended") throw new Error(body.state);
        const kinds = new Set(body.record.events.map((e) => e.kind));
        expect([...kinds].sort()).toEqual(
            [
                "allowance",
                "file",
                "job",
                "mcp",
                "payment",
                "placement",
                "preview",
                "secret_host",
                "ssh",
                "transfer",
                "x402",
            ].sort(),
        );
        const jobs = body.record.jobs;
        expect(jobs).toHaveLength(6);
        expect(jobs.some((j) => j.state === "exited" && j.exitCode === 0)).toBe(true);
        expect(jobs.some((j) => j.exitCode === 1 && j.frames?.some((f) => f.s === "e"))).toBe(true);
        expect(jobs.some((j) => j.oom)).toBe(true);
        expect(jobs.some((j) => j.state === "cancelled")).toBe(true);
        expect(jobs.some((j) => j.state === "lost")).toBe(true);
        expect(jobs.some((j) => j.cutBytes > 0 && j.frames?.some((f) => f.cr))).toBe(true);
    });
});

describe("parseGetBody", () => {
    it("reads the record example", () => {
        const record = ended(exampleRecord());
        expect(record).toEqual({
            startedAt: new Date("2026-11-06T10:00:00Z"),
            endedAt: new Date("2026-11-06T10:10:00Z"),
            endedBecause: "deadline",
            deletesAt: new Date("2026-11-08T10:10:00Z"),
            output: "complete",
            events: [
                {
                    at: new Date("2026-11-06T10:00:01Z"),
                    kind: "placement",
                    phase: "placed",
                    packageId: "dev-small-10m",
                    vcpu: 2,
                    memoryMib: 2048,
                    diskGib: 10,
                    minutes: 10,
                },
            ],
            eventsDropped: 0,
            jobs: [
                {
                    seq: 1,
                    command: "npm test",
                    state: "exited",
                    startedAt: new Date("2026-11-06T10:01:00Z"),
                    finishedAt: new Date("2026-11-06T10:02:00Z"),
                    exitCode: 0,
                    oom: false,
                    peakMib: 512,
                    outBytes: null,
                    errBytes: null,
                    cutBytes: 0,
                    frames: [{ s: "o", t: "ok 12 tests\n", cr: false }],
                },
            ],
            jobsDropped: 0,
        });
    });

    it("reads the snapshot example", () => {
        expect(parseGetBody({ state: "running", snapshot: exampleSnapshot() })).toEqual({
            state: "running",
            snapshot: {
                startedAt: new Date("2026-11-06T10:00:00Z"),
                deadline: new Date("2026-11-06T10:10:00Z"),
                now: new Date("2026-11-06T10:03:00Z"),
                jobs: [
                    {
                        seq: 1,
                        command: "npm test",
                        state: "running",
                        startedAt: new Date("2026-11-06T10:01:00Z"),
                        finishedAt: null,
                        exitCode: null,
                        oom: false,
                        peakMib: 0,
                        outBytes: 2048,
                        errBytes: 0,
                        cutBytes: 0,
                        frames: null,
                    },
                ],
                jobsDropped: 0,
            },
        });
    });

    it("reads the commands past the router's cap, on a record and a snapshot", () => {
        expect(ended({ ...exampleRecord(), jobsDropped: 7 }).jobsDropped).toBe(7);
        const body = parseGetBody({
            state: "running",
            snapshot: { ...exampleSnapshot(), jobsDropped: 3 },
        });
        expect(body.state === "running" && body.snapshot.jobsDropped).toBe(3);
    });

    it("reads an expired answer, which has no payload", () => {
        expect(parseGetBody({ state: "expired" })).toEqual({ state: "expired" });
    });

    it("answers too-new for any v but 1, before reading another field", () => {
        for (const v of [2, undefined, "1", 0]) {
            const record = { ...exampleRecord(), v };
            expect(parseGetBody({ state: "ended", record }), String(v)).toEqual({
                state: "too-new",
            });
            expect(
                parseGetBody({ state: "running", snapshot: { ...exampleSnapshot(), v } }),
            ).toEqual({ state: "too-new" });
        }
        expect(parseGetBody({ state: "ended", record: { v: 2 } })).toEqual({ state: "too-new" });
    });

    it("answers too-new for a state it does not know", () => {
        expect(parseGetBody({ state: "archived" })).toEqual({ state: "too-new" });
    });

    it("refuses a body it cannot trust the shape of", () => {
        for (const bad of [
            null,
            "ended",
            [],
            {},
            { state: 1 },
            { state: "ended" },
            { state: "ended", record: [] },
            { state: "running" },
        ]) {
            expect(() => parseGetBody(bad), JSON.stringify(bad)).toThrow(PayloadError);
        }
    });

    it("throws when a required time is missing or invalid", () => {
        const noStart = exampleRecord();
        delete noStart.startedAt;
        expect(() => ended(noStart)).toThrow(PayloadError);
        expect(() => ended({ ...exampleRecord(), endedAt: "yesterday" })).toThrow(PayloadError);
        expect(() => ended({ ...exampleRecord(), deletesAt: 1_700_000_000 })).toThrow(PayloadError);
        const snapshot = { ...exampleSnapshot(), now: "not a time" };
        expect(() => parseGetBody({ state: "running", snapshot })).toThrow(PayloadError);
    });

    it("throws on an output state it does not know", () => {
        expect(() => ended({ ...exampleRecord(), output: "done" })).toThrow(PayloadError);
    });

    it("gives an unknown endedBecause as other", () => {
        expect(ended({ ...exampleRecord(), endedBecause: "abuse" }).endedBecause).toBe("other");
        const noReason = exampleRecord();
        delete noReason.endedBecause;
        expect(ended(noReason).endedBecause).toBe("other");
        const record = ended(
            withEvents({ at, kind: "placement", phase: "ended", endedBecause: "operator" }),
        );
        expect(record.events[0]).toMatchObject({ kind: "placement", endedBecause: "other" });
    });

    it("drops an unknown event kind and keeps the others", () => {
        const record = ended(
            withEvents(
                { at, kind: "teleport", to: "mars" },
                { at, kind: "mcp", tool: "bugnet_exec", outcome: "ok", durationMs: 120 },
                "not an event",
                null,
            ),
        );
        expect(record.events).toEqual([
            {
                at: new Date(at),
                kind: "mcp",
                tool: "bugnet_exec",
                outcome: "ok",
                durationMs: 120,
            },
        ]);
    });

    it("drops a known kind with a bad field", () => {
        const valid = [
            { at, kind: "payment", payKind: "start", amountMicros: 50_000, tx: sig },
            { at, kind: "file", op: "read", path: "/a", bytes: 1 },
            { at, kind: "preview", port: 3000, phase: "issued" },
            servedCall(),
            servedAllowance({ amountMicros: 1 }),
        ];
        expect(ended(withEvents(...valid)).events).toHaveLength(valid.length);
        const bad = [
            { ...valid[0], amountMicros: "50000" },
            { ...valid[0], payKind: "refund" },
            { ...valid[1], at: "soon" },
            { ...valid[1], op: "delete" },
            { ...valid[1], bytes: -1 },
            { ...valid[2], port: "3000" },
            { ...valid[3], status: 7 },
            { ...valid[3], host: undefined },
            { ...valid[3], count: 2.5 },
            { ...valid[3], resolved: "refunded" },
            { ...valid[3], resent: "yes" },
            { ...valid[4], amountMicros: 1.5 },
            { ...valid[4], phase: "spent" },
        ];
        const record = ended(withEvents(...bad, { at, kind: "ssh", phase: "start" }));
        expect(record.events).toEqual([{ at: new Date(at), kind: "ssh", phase: "start" }]);
    });

    it("keeps an x402 call whose status it does not know, so no paid call is lost", () => {
        const call = servedCall({ status: "settled_late" });
        expect(ended(withEvents(call)).events).toEqual([
            { ...call, at: new Date(at), resent: false },
        ]);
    });

    it("names the payment's own kind payKind, apart from the event's kind", () => {
        const record = ended(
            withEvents({ at, kind: "payment", payKind: "extend", amountMicros: 25_000, tx: sig }),
        );
        expect(record.events).toEqual([
            {
                at: new Date(at),
                kind: "payment",
                payKind: "extend",
                amountMicros: 25_000,
                tx: sig,
            },
        ]);
    });

    it("reads every kind's fields", () => {
        const deadline = "2026-11-06T10:15:00Z";
        const record = ended(
            withEvents(
                { at, kind: "placement", phase: "extended", minutes: 5, deadline },
                { at, kind: "payment", payKind: "start", amountMicros: 50_000, tx: "not base58" },
                { at, kind: "job", seq: 2, phase: "end", exitCode: 1, durationMs: 9_200 },
                { at, kind: "file", op: "write", path: "/w/a.txt", bytes: 12 },
                { at, kind: "preview", port: 3000, phase: "traffic", requests: 4, bytes: 900 },
                { at, kind: "transfer", direction: "out", name: "r.zip", bytes: 2048 },
                { at, kind: "ssh", phase: "end", bytesIn: 10, bytesOut: 20 },
                { at, kind: "secret_host", host: "api.github.com", requests: 3, bytes: 70 },
                {
                    at,
                    kind: "x402",
                    host: "pay.example",
                    method: "GET",
                    path: "/v1/weather",
                    status: "refused_price",
                    reason: "price_above_max",
                    count: 1,
                    askedMicros: 50_000,
                    amountMicros: 0,
                    asset: "USDC",
                    network,
                    allowanceLeftMicros: 997_000,
                    resolved: null,
                },
                {
                    at,
                    kind: "allowance",
                    phase: "refunded",
                    amountMicros: 982_000,
                    asset: "USDC",
                    network,
                    tx: sig,
                },
            ),
        );
        const time = new Date(at);
        expect(record.events).toEqual([
            {
                at: time,
                kind: "placement",
                phase: "extended",
                minutes: 5,
                deadline: new Date(deadline),
            },
            { at: time, kind: "payment", payKind: "start", amountMicros: 50_000, tx: "not base58" },
            { at: time, kind: "job", seq: 2, phase: "end", exitCode: 1, durationMs: 9_200 },
            { at: time, kind: "file", op: "write", path: "/w/a.txt", bytes: 12 },
            { at: time, kind: "preview", port: 3000, phase: "traffic", requests: 4, bytes: 900 },
            { at: time, kind: "transfer", direction: "out", name: "r.zip", bytes: 2048 },
            { at: time, kind: "ssh", phase: "end", bytesIn: 10, bytesOut: 20 },
            { at: time, kind: "secret_host", host: "api.github.com", requests: 3, bytes: 70 },
            {
                at: time,
                kind: "x402",
                host: "pay.example",
                method: "GET",
                path: "/v1/weather",
                status: "refused_price",
                reason: "price_above_max",
                count: 1,
                askedMicros: 50_000,
                amountMicros: 0,
                asset: "USDC",
                network,
                allowanceLeftMicros: 997_000,
                resolved: null,
                resent: false,
            },
            {
                at: time,
                kind: "allowance",
                phase: "refunded",
                amountMicros: 982_000,
                asset: "USDC",
                network,
                tx: sig,
            },
        ]);
    });

    it("fills a record job's byte counts from its job end event", () => {
        const second = {
            seq: 2,
            command: null,
            state: "lost",
            startedAt: "2026-11-06T10:03:00Z",
        };
        const record = ended({
            ...withEvents(
                { at, kind: "job", seq: 1, phase: "start" },
                { at, kind: "job", seq: 1, phase: "end", exitCode: 0, outBytes: 12, errBytes: 3 },
            ),
            jobs: [(exampleRecord().jobs as unknown[])[0], second],
        });
        expect(record.jobs.map((j) => [j.seq, j.outBytes, j.errBytes])).toEqual([
            [1, 12, 3],
            [2, null, null],
        ]);
        expect(record.jobs[1]).toMatchObject({ command: null, exitCode: null, frames: null });
    });

    it("throws on a frame from a stream it does not know", () => {
        const record = exampleRecord();
        const [job] = record.jobs as Record<string, unknown>[];
        job!.frames = [{ s: "x", t: "hi\n", cr: false }];
        expect(() => ended(record)).toThrow(PayloadError);
    });

    it("throws on a job it cannot read", () => {
        const job = (exampleRecord().jobs as Record<string, unknown>[])[0]!;
        for (const bad of [
            { ...job, seq: 0 },
            { ...job, seq: "1" },
            { ...job, state: "paused" },
            { ...job, startedAt: undefined },
            { ...job, command: 7 },
            { ...job, frames: "ok" },
            { ...job, frames: [{ s: "o", t: 1, cr: false }] },
        ]) {
            expect(() => ended({ ...exampleRecord(), jobs: [bad] }), JSON.stringify(bad)).toThrow(
                PayloadError,
            );
        }
    });
});

describe("parseGetBody with served x402 and allowance rows", () => {
    const one = (event: unknown) => ended(withEvents(event)).events;

    it("reads a paying row and its resent row with every served field", () => {
        const resent = servedCall({ amountMicros: 0, tx: undefined, resent: true });
        expect(ended(withEvents(servedCall(), resent)).events).toEqual([
            {
                at: new Date(at),
                kind: "x402",
                host: "pay.example",
                method: "POST",
                path: "/v1/search",
                status: "paid",
                reason: "",
                count: 1,
                askedMicros: 3_000,
                amountMicros: 3_000,
                asset: "USDC",
                network,
                httpStatus: 200,
                durationMs: 1_840,
                bytesOut: 412,
                bytesIn: 18_204,
                streamCut: false,
                allowanceLeftMicros: 997_000,
                resolved: "paid",
                tx: sig,
                resent: false,
            },
            {
                at: new Date(at),
                kind: "x402",
                host: "pay.example",
                method: "POST",
                path: "/v1/search",
                status: "paid",
                reason: "",
                count: 1,
                askedMicros: 3_000,
                amountMicros: 0,
                asset: "USDC",
                network,
                httpStatus: 200,
                durationMs: 1_840,
                bytesOut: 412,
                bytesIn: 18_204,
                streamCut: false,
                allowanceLeftMicros: 997_000,
                resolved: "paid",
                resent: true,
            },
        ]);
    });

    it("reads an absent resolved as still settling and an absent resent as not resent", () => {
        const [call] = one(servedCall({ resolved: undefined, tx: undefined }));
        expect(call).toMatchObject({ kind: "x402", resolved: null, resent: false });
        expect(call).not.toHaveProperty("tx");
        expect(one(servedCall({ resolved: null, tx: undefined }))[0]).toMatchObject({
            resolved: null,
        });
        expect(one(servedCall({ resolved: "released", tx: undefined }))[0]).toMatchObject({
            resolved: "released",
        });
    });

    it("drops a row with no calls in it, and only that row", () => {
        const events = ended(
            withEvents(servedCall({ count: 0 }), servedCall({ count: 40, path: "/v1/folded" })),
        ).events;
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ count: 40, path: "/v1/folded" });
    });

    it("keeps a status it does not know as its raw word", () => {
        expect(one(servedCall({ status: "refused_mood" }))[0]).toMatchObject({
            status: "refused_mood",
        });
    });

    it("keeps the empty host, method and path of the overflow refused_host row", () => {
        const overflow = {
            at,
            kind: "x402",
            host: "",
            method: "",
            path: "",
            status: "refused_host",
            reason: "",
            count: 17,
            askedMicros: 0,
            amountMicros: 0,
            network: "",
        };
        expect(one(overflow)).toEqual([
            { ...overflow, at: new Date(at), resolved: null, resent: false },
        ]);
    });

    it("allows a row with no asset, which the router leaves out for any mint but USDC", () => {
        const [call] = one(servedCall({ asset: undefined }));
        expect(call).toMatchObject({ kind: "x402", amountMicros: 3_000 });
        expect(call).not.toHaveProperty("asset");
    });

    it("shows a transaction only on a row resolved as paid", () => {
        for (const resolved of [null, "released"]) {
            const [call] = one(servedCall({ resolved }));
            expect(call, String(resolved)).not.toHaveProperty("tx");
        }
    });

    it("reads the amount kept under the minimum, which has no transaction", () => {
        const kept = servedAllowance({ phase: "kept", amountMicros: 0, keptMicros: 4_000 });
        delete kept.tx;
        expect(one(kept)).toEqual([
            {
                at: new Date(at),
                kind: "allowance",
                phase: "kept",
                amountMicros: 0,
                keptMicros: 4_000,
                asset: "USDC",
                network,
            },
        ]);
    });

    it("reads an allowance in a mint other than USDC, which the router serves with no asset", () => {
        const row = servedAllowance();
        delete row.asset;
        const [allowance] = one(row);
        expect(allowance).toMatchObject({ kind: "allowance", phase: "paid", tx: sig });
        expect(allowance).not.toHaveProperty("asset");
    });

    it("drops an allowance paid in or refunded without its transaction", () => {
        for (const phase of ["paid", "refunded"]) {
            const row = servedAllowance({ phase });
            delete row.tx;
            const events = ended(withEvents(row, servedAllowance({ phase }))).events;
            expect(events, phase).toHaveLength(1);
            expect(events[0], phase).toMatchObject({ phase, tx: sig });
        }
    });

    it("leaves off every key the router does not serve", () => {
        const secret = {
            payTo: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
            ref: "k3m7q2x7a4b6c5d2",
            paymentRef: "k3m7q2x7a4b6c5d2",
            payment_ref: "k3m7q2x7a4b6c5d2",
            serviceId: "svc_1",
            scheme: "exact",
        };
        const [call] = one(servedCall(secret));
        const [allowance] = one(servedAllowance(secret));
        for (const key of Object.keys(secret)) {
            expect(call, key).not.toHaveProperty(key);
            expect(allowance, key).not.toHaveProperty(key);
        }
    });
});

describe("isSignature", () => {
    it("accepts base58 that decodes to 64 bytes, at 86, 87 or 88 characters", () => {
        for (const length of [86, 87, 88] as const) {
            const tx = sampleTx(`length-${length}`, length);
            expect(tx).toHaveLength(length);
            expect(isSignature(tx), tx).toBe(true);
        }
    });

    it("refuses base58 that decodes to 63 or 65 bytes, whatever its length", () => {
        const short = base58(Buffer.alloc(63, 0xff));
        const long = base58(Buffer.alloc(65, 0x01));
        expect([short.length, long.length]).toEqual([87, 88]);
        expect(isSignature(short)).toBe(false);
        expect(isSignature(long)).toBe(false);
        // 58^86 - 1 fits in 63 bytes and 58^88 - 1 needs 65
        expect(isSignature("z".repeat(86))).toBe(false);
        expect(isSignature("z".repeat(88))).toBe(false);
        expect(isSignature(`${sig}1`)).toBe(false);
    });

    it("counts each leading 1 as a zero byte", () => {
        expect(isSignature("1".repeat(64))).toBe(true);
        expect(isSignature("1".repeat(63))).toBe(false);
        expect(isSignature("1".repeat(65))).toBe(false);
        expect(isSignature(base58(Buffer.concat([Buffer.alloc(2), Buffer.alloc(62, 0xff)])))).toBe(
            true,
        );
    });

    it("refuses characters outside base58, the empty string and very long input", () => {
        for (const c of "0OIl") expect(isSignature(`${c}${sig.slice(1)}`), c).toBe(false);
        expect(isSignature("")).toBe(false);
        expect(isSignature(`${sig}\n`)).toBe(false);
        expect(isSignature("z".repeat(20_000))).toBe(false);
        expect(isSignature("1".repeat(20_000))).toBe(false);
    });
});
