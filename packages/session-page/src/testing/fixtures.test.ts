import { describe, expect, it } from "vitest";
import { ID_RE, KEY_RE } from "../link.ts";
import { parseGetBody, type Frame, type GetBody, type SessionRecord } from "../payload.ts";
import { makeScenarios, sampleStrings, type Scenario, type ScenarioName } from "./fixtures.ts";

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

describe("makeScenarios", () => {
    it("gives each scenario its own valid id and key", () => {
        const all = Object.entries(scenarios);
        expect(all).toHaveLength(12);
        for (const [name, s] of all) {
            expect(s.kind).toBe(name);
            expect(s.id, name).toMatch(ID_RE);
            expect(s.key, name).toMatch(KEY_RE);
        }
        expect(new Set(all.map(([, s]) => s.id)).size).toBe(12);
        expect(new Set(all.map(([, s]) => s.key)).size).toBe(12);
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
        expect(txs.some((tx) => !/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(tx))).toBe(true);
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
