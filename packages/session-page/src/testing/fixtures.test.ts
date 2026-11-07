import { describe, expect, it } from "vitest";
import { ID_RE, KEY_RE } from "../link.ts";
import {
    isSignature,
    parseGetBody,
    type Frame,
    type GetBody,
    type SessionRecord,
    type X402Event,
} from "../payload.ts";
import {
    base58,
    makeScenarios,
    sampleStrings,
    type JsonObject,
    type Scenario,
    type ScenarioName,
} from "./fixtures.ts";

const now = new Date("2026-11-06T12:00:00Z");
const scenarios = makeScenarios(now);

function parsed(scenario: Scenario, get = 0): GetBody {
    return parseGetBody(scenario.gets[get]!.body);
}

function record(name: ScenarioName, get = 0): SessionRecord {
    const body = parsed(scenarios[name], get);
    if (body.state !== "ended") throw new Error(`${name} is ${body.state}`);
    return body.record;
}

function labels(r: SessionRecord): string[] {
    return r.events.flatMap((e) => {
        if (e.kind === "secret_host" || e.kind === "x402") return [e.host];
        if (e.kind === "file") return [e.path];
        if (e.kind === "transfer") return [e.name];
        return [];
    });
}

const MONEY_STATUSES = ["paid", "uncertain", "payment_failed"];
const NOT_REFUSED = [...MONEY_STATUSES, "free", "self_paid"];

function calls(r: SessionRecord): X402Event[] {
    return r.events.filter((e): e is X402Event => e.kind === "x402");
}

const isSettling = (e: X402Event) =>
    MONEY_STATUSES.includes(e.status) && e.resolved === null && !e.resent;

// The sums of x402 spec 8.6's check, counted by its money rules
function balance(r: SessionRecord) {
    let paidIn = 0;
    let spent = 0;
    let refunded = 0;
    let kept = 0;
    for (const e of r.events) {
        if (e.kind === "allowance") {
            if (e.phase === "paid") paidIn += e.amountMicros;
            if (e.phase === "refunded") refunded += e.amountMicros;
            if (e.phase === "kept") kept += e.keptMicros ?? 0;
        }
        if (e.kind === "x402" && e.resolved === "paid" && !e.resent) spent += e.amountMicros;
    }
    const settling = calls(r).filter(isSettling).length;
    return { paidIn, spent, refunded, kept, settling, off: paidIn - spent - refunded - kept };
}

describe("makeScenarios", () => {
    it("gives each scenario its own valid id and key", () => {
        const all = Object.entries(scenarios);
        expect(all).toHaveLength(16);
        for (const [name, s] of all) {
            expect(s.kind).toBe(name);
            expect(s.id, name).toMatch(ID_RE);
            expect(s.key, name).toMatch(KEY_RE);
        }
        expect(new Set(all.map(([, s]) => s.id)).size).toBe(16);
        expect(new Set(all.map(([, s]) => s.key)).size).toBe(16);
    });

    it("keeps the same ids and keys across calls, so dev links stay put", () => {
        const again = makeScenarios(new Date("2027-01-01T00:00:00Z"));
        expect(again["ended-full"].id).toBe(scenarios["ended-full"].id);
        expect(again["ended-full"].key).toBe(scenarios["ended-full"].key);
    });

    it("marks a command and a label of each scenario with its sentinel", () => {
        for (const s of Object.values(scenarios)) {
            const sentinel = `zz-sample-${s.kind}`;
            const wire = JSON.stringify({ gets: s.gets, live: s.live });
            if (s.kind === "expired" || s.kind === "rate-limited") {
                expect(wire, s.kind).not.toContain("zz-sample");
                continue;
            }
            expect(wire, s.kind).toContain(sentinel);
        }
        for (const name of Object.keys(scenarios) as ScenarioName[]) {
            const sentinel = `zz-sample-${name}`;
            if (scenarios[name].gets[0]!.body === null) continue;
            const body = parsed(scenarios[name]);
            if (body.state === "running") {
                expect(body.snapshot.jobs.some((j) => j.command?.includes(sentinel))).toBe(true);
            }
            if (body.state !== "ended") continue;
            const r = body.record;
            if (r.jobs.length > 0) {
                expect(
                    r.jobs.some((j) => j.command?.includes(sentinel)),
                    name,
                ).toBe(true);
            }
            if (labels(r).length > 0) {
                expect(
                    labels(r).some((l) => l.includes(sentinel)),
                    name,
                ).toBe(true);
            }
        }
    });

    it("lists every sentinel, id, key and long command or host for the dist check", () => {
        const strings = sampleStrings(scenarios);
        for (const s of Object.values(scenarios)) {
            expect(strings).toContain(`zz-sample-${s.kind}`);
            expect(strings).toContain(s.id);
            expect(strings).toContain(s.key);
        }
        const full = record("ended-full");
        for (const j of full.jobs) {
            if ((j.command ?? "").length >= 12) expect(strings).toContain(j.command);
        }
        for (const l of labels(full)) if (l.length >= 12) expect(strings).toContain(l);
        expect(strings.every((s) => s.length >= 12)).toBe(true);
    });

    it("dates ended-full in the past, with its page deleted 48 h after the end", () => {
        const r = record("ended-full");
        expect(r.endedAt.getTime()).toBeLessThan(now.getTime());
        expect(r.deletesAt.getTime() - r.endedAt.getTime()).toBe(48 * 3_600_000);
        expect(r.output).toBe("complete");
    });

    it("signs ended-full's payments with real signatures of 86, 87 and 88 characters", () => {
        const txs = record("ended-full").events.flatMap((e) =>
            "tx" in e && e.tx !== undefined ? [e.tx] : [],
        );
        expect(txs.length).toBeGreaterThan(0);
        for (const tx of txs) expect(isSignature(tx), tx).toBe(true);
        expect(new Set(txs.map((tx) => tx.length))).toEqual(new Set([86, 87, 88]));
    });

    it("answers ended-pending pending twice, without frames, then complete", () => {
        const outputs = scenarios["ended-pending"].gets.map((_, i) => record("ended-pending", i));
        expect(outputs.map((r) => r.output)).toEqual(["pending", "pending", "complete"]);
        expect(outputs[0]!.jobs.every((j) => j.frames === null)).toBe(true);
        expect(outputs[2]!.jobs.every((j) => j.frames !== null)).toBe(true);
        expect(outputs[0]!.events.length).toBeGreaterThan(0);
    });

    it("gives the output states their scenarios", () => {
        expect(record("ended-output-expired").output).toBe("expired");
        expect(record("ended-partial").output).toBe("partial");
    });

    it("leaves ended-empty with placement events only and no jobs", () => {
        const r = record("ended-empty");
        expect(r.jobs).toEqual([]);
        expect(r.events.length).toBeGreaterThan(0);
        expect(r.events.every((e) => e.kind === "placement")).toBe(true);
    });

    it("crowds ended-crowded past every fold", () => {
        const r = record("ended-crowded");
        const hosts = (kind: string) =>
            new Set(r.events.flatMap((e) => (e.kind === kind && "host" in e ? [e.host] : [])));
        expect(hosts("secret_host").size).toBe(12);
        expect(hosts("x402").size).toBe(9);
        const ports = new Set(r.events.flatMap((e) => (e.kind === "preview" ? [e.port] : [])));
        expect(ports.size).toBe(7);
        expect(r.eventsDropped).toBe(120);
    });

    it("carries the hostile cases in ended-hostile", () => {
        const r = record("ended-hostile");
        const text = r.jobs.flatMap((j) => j.frames ?? []).map((f) => f.t);
        const all = text.join("");
        expect(all).toContain("<img src=x onerror=alert(1)>");
        expect(labels(r)).toContain("<img src=x onerror=alert(1)>");
        expect(labels(r).some((l) => l.length === 63)).toBe(true);
        expect(all.split("\n").some((line) => line.length === 20_000)).toBe(true);
        const lineCount = (frames: Frame[]) =>
            frames
                .map((f) => f.t)
                .join("")
                .split("\n").length - 1;
        expect(Math.max(...r.jobs.map((j) => lineCount(j.frames ?? [])))).toBe(6_000);
        expect(all).toMatch(/wallet/i);
        const txs = r.events.flatMap((e) => ("tx" in e && e.tx !== undefined ? [e.tx] : []));
        expect(txs.some((tx) => !isSignature(tx))).toBe(true);
    });

    it("runs two jobs and has two finished in running, with a script for each", () => {
        const body = parsed(scenarios.running);
        if (body.state !== "running") throw new Error(body.state);
        const { snapshot } = body;
        expect(snapshot.now).toEqual(now);
        expect(snapshot.deadline.getTime() - now.getTime()).toBe(7 * 60_000);
        expect(snapshot.jobs.filter((j) => j.state === "running")).toHaveLength(2);
        expect(snapshot.jobs.filter((j) => j.state !== "running")).toHaveLength(2);
        for (const j of snapshot.jobs) {
            const script = scenarios.running.live[j.seq];
            expect(script, String(j.seq)).toBeDefined();
            expect(script!.frames.length).toBeGreaterThan(0);
            expect(script!.exit === null).toBe(j.state === "running");
        }
        expect(Object.values(scenarios.running.live).some((s) => s.frames.some((f) => f.cr))).toBe(
            true,
        );
    });

    it("answers the plain states as the route does", () => {
        expect(parsed(scenarios.expired)).toEqual({ state: "expired" });
        expect(parsed(scenarios["too-new"])).toEqual({ state: "too-new" });
        expect(scenarios["rate-limited"].gets).toEqual([{ status: 429, body: null }]);
        expect(parsed(scenarios.deletable).state).toBe("ended");
    });
});

describe("the x402 scenarios", () => {
    const names = [
        "ended-x402",
        "ended-x402-settling",
        "ended-x402-kept",
        "ended-x402-reconcile",
    ] as const;

    it("parses every answer of each, dropping no event", () => {
        for (const name of names) {
            scenarios[name].gets.forEach((answer, i) => {
                const wire = answer.body as { record: { events: unknown[] } };
                expect(record(name, i).events, `${name} ${i}`).toHaveLength(
                    wire.record.events.length,
                );
            });
        }
    });

    it("serves only resolved-paid rows with a transaction, each a real signature", () => {
        for (const name of names) {
            scenarios[name].gets.forEach((_, i) => {
                for (const e of calls(record(name, i))) {
                    if (e.tx === undefined) continue;
                    expect(e.resolved, name).toBe("paid");
                    expect(e.resent, name).toBe(false);
                    expect(isSignature(e.tx), name).toBe(true);
                }
            });
        }
    });

    it("carries every kind of x402 row in ended-x402", () => {
        const r = record("ended-x402");
        const rows = calls(r);
        const paid = rows.filter((e) => e.resolved === "paid" && !e.resent);
        expect(paid.some((e) => e.amountMicros > 0 && e.tx !== undefined)).toBe(true);

        const resent = rows.filter((e) => e.resent);
        expect(resent).toHaveLength(1);
        expect(resent[0]).toMatchObject({ amountMicros: 0, resolved: "paid" });
        expect(resent[0]).not.toHaveProperty("tx");
        const payer = paid.find(
            (e) => e.host === resent[0]!.host && e.path === resent[0]!.path && e.at < resent[0]!.at,
        );
        expect(payer?.amountMicros).toBeGreaterThan(0);

        const settling = rows.filter(isSettling);
        expect(settling.some((e) => e.status === "paid" && e.amountMicros > 0)).toBe(true);
        expect(
            settling.some((e) => e.status === "uncertain" && e.reason === "paid_no_answer"),
        ).toBe(true);

        const released = rows.filter((e) => e.resolved === "released");
        expect(released.length).toBeGreaterThan(0);
        expect(released.every((e) => e.tx === undefined)).toBe(true);

        expect(rows.some((e) => e.status === "free" && e.count === 12)).toBe(true);
        expect(rows.some((e) => e.status === "self_paid")).toBe(true);

        const refused = rows.filter((e) => !NOT_REFUSED.includes(e.status));
        const reasons = new Set(
            refused.map((e) => (e.status === "refused_host" ? "refused_host" : e.reason)),
        );
        expect(reasons.size).toBeGreaterThanOrEqual(5);
        expect(refused.some((e) => e.count === 40)).toBe(true);

        const unregistered = rows.filter((e) => e.status === "refused_host");
        const named = new Set(unregistered.map((e) => e.host).filter((h) => h !== ""));
        expect(named.size).toBe(3);
        const overflow = unregistered.filter((e) => e.host === "");
        expect(overflow).toHaveLength(1);
        expect(overflow[0]).toMatchObject({ method: "", path: "" });

        const phases = r.events.flatMap((e) => (e.kind === "allowance" ? [e.phase] : []));
        expect(phases).toEqual(["paid", "refunded"]);
    });

    it("answers ended-x402-settling with settling rows first, then resolves them", () => {
        const gets = scenarios["ended-x402-settling"].gets;
        expect(gets.length).toBeGreaterThanOrEqual(2);
        const first = record("ended-x402-settling");
        const last = record("ended-x402-settling", gets.length - 1);
        const settling = calls(first).filter(isSettling);
        expect(settling.length).toBeGreaterThan(0);
        expect(calls(last).filter(isSettling)).toEqual([]);
        for (const e of settling) {
            const later = calls(last).find((l) => l.at.getTime() === e.at.getTime());
            expect(later?.resolved, e.path).not.toBeNull();
        }
        // Inside the 30 minutes after the end in which the page asks again
        expect(now.getTime() - first.endedAt.getTime()).toBeLessThan(30 * 60_000);
        expect(balance(last).off).toBe(0);
    });

    it("keeps an amount under the minimum in ended-x402-kept, and its totals balance", () => {
        const r = record("ended-x402-kept");
        const kept = r.events.filter((e) => e.kind === "allowance" && e.phase === "kept");
        expect(kept).toHaveLength(1);
        expect(kept[0]).toMatchObject({ amountMicros: 0 });
        expect(kept[0]).not.toHaveProperty("tx");
        const b = balance(r);
        expect(b.kept).toBeGreaterThan(0);
        expect(b.kept).toBeLessThan(10_000);
        expect(b.refunded).toBe(0);
        expect(b.settling).toBe(0);
        expect(b.off).toBe(0);
    });

    it("ends ended-x402-reconcile with nothing settling and totals that do not balance", () => {
        const r = record("ended-x402-reconcile");
        expect(r.events.some((e) => e.kind === "placement" && e.phase === "ended")).toBe(true);
        const b = balance(r);
        expect(b.settling).toBe(0);
        expect(b.refunded).toBeGreaterThan(0);
        expect(b.off).not.toBe(0);
    });

    it("serves the old scenarios' x402 rows in the served shape", () => {
        for (const name of ["ended-full", "ended-crowded", "ended-hostile"] as const) {
            const wire = scenarios[name].gets[0]!.body as { record: { events: JsonObject[] } };
            const rows = wire.record.events.filter((e) => e.kind === "x402");
            expect(rows.length, name).toBeGreaterThan(0);
            for (const e of rows) {
                expect(e, name).toHaveProperty("count", 1);
                expect(e, name).toHaveProperty("reason");
                expect(e, name).toHaveProperty("resolved");
                if (e.tx !== undefined) expect(e.resolved, name).toBe("paid");
            }
        }
    });
});

describe("base58", () => {
    it("encodes as Bitcoin's alphabet does, so sample signatures decode like real ones", () => {
        const hex = (h: string) => Buffer.from(h, "hex");
        expect(base58(hex("61"))).toBe("2g");
        expect(base58(hex("626262"))).toBe("a3gV");
        expect(base58(Buffer.from("simply a long string"))).toBe("2cFupjhnEsSn59qHXstmK2ffpLv2");
        expect(base58(hex("00eb15231dfceb60925886b67d065299925915aeb172c06647"))).toBe(
            "1NS17iag9jJgTHD1VXjvLCEnZuQ3rJDE9L",
        );
        expect(base58(hex("00000000000000000000"))).toBe("1111111111");
    });
});
