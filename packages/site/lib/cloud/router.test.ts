import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { catalogPackages } from "../landing/catalog";
import {
    cloudProviders,
    lifetimeSlackMinutes,
    locked,
    refused,
    sizeFor,
    type CloudProvider,
    type Size,
} from "./servers";

// The router's repository, when it is checked out beside this one
const router = join(__dirname, "../../../../../bugnet-router");
const read = (path: string) => readFileSync(join(router, path), "utf8");

function provider(id: string): CloudProvider {
    const p = cloudProviders.find((c) => c.id === id);
    if (!p) throw new Error(`no provider ${id}`);
    return p;
}

/** The text of a Go function or method, from its name to the closing brace at the line's start */
function goFunc(source: string, name: string): string {
    const at = Math.max(source.indexOf(`) ${name}(`), source.indexOf(`func ${name}(`));
    expect(at, name).toBeGreaterThan(-1);
    return source.slice(at, source.indexOf("\n}", at));
}

/** A Go integer literal, such as 1_000 */
const goInt = (literal: string | undefined) => BigInt((literal ?? "").replaceAll("_", ""));

/** The values of one TOML key in each table of an array of tables, such as [[e2b.templates]] */
function tomlTables(toml: string, header: string): Record<string, string>[] {
    return toml
        .split(`[[${header}]]`)
        .slice(1)
        .map((block) => {
            const fields: Record<string, string> = {};
            for (const line of block.split("\n")) {
                if (line.startsWith("[")) break;
                const m = /^(\w+)\s*=\s*"?([^"#\s]+)"?/.exec(line);
                if (m) fields[m[1] as string] = m[2] as string;
            }
            return fields;
        });
}

describe.runIf(existsSync(router))("the router's production providers", () => {
    const toml = read("deploy/vps/config/router.toml");

    it("are the ones listed, in the router's order", () => {
        const line = /^providers\s*=\s*\[([^\]]*)\]/m.exec(toml)?.[1] ?? "";
        const ids = [...line.matchAll(/"(\w+)"/g)].map((m) => m[1]);
        expect(cloudProviders.map((p) => p.id)).toEqual(ids);
    });

    it("each pick the first size with enough vCPU, memory and disk, as sizeFor does", () => {
        for (const id of ["boat", "e2b", "boxd"]) {
            const pick = goFunc(read(`internal/provider/${id}/${id}.go`), "SizeFor");
            for (const field of ["VCPU", "MemoryMiB", "DiskGiB"]) {
                expect(pick, `${id} ${field}`).toMatch(new RegExp(`>= floor\\.${field}\\b`));
            }
            expect(pick, id).toMatch(/floor\.GPUCount (>|==) 0/);
        }
    });

    it("leave each adapter's defaults as they are", () => {
        // No [e2b] domain or lifetime, no [boxd] region, no other [boat] setting
        expect(toml).not.toMatch(/^\[(boat|boxd|e2b)\]/m);
    });

    it("lock only sizes production sells", () => {
        for (const n of locked) {
            expect(provider(n.provider).sizes.map((s) => s.name)).toContain(n.size);
        }
    });

    it("sell the Boat types production names, in their written order, for 30 days, run as user", () => {
        const go = read("internal/provider/boat/boat.go");
        const types: Size[] = [
            ...go.matchAll(
                /\{"(\w+)", provider\.Resources\{VCPU: (\d+), MemoryMiB: (\d+) << 10, DiskGiB: (\d+)\}/g,
            ),
        ].map((m) => ({
            name: m[1] as string,
            vcpu: Number(m[2]),
            memoryMiB: Number(m[3]) * 1024,
            diskGiB: Number(m[4]),
        }));
        // Production sells the types [boat.types] names, or every type when it names none
        const table = /^\[boat\.types\][^\n]*\n((?:[^[\n].*\n|\n)*)/m.exec(toml)?.[1] ?? "";
        const sold = [...table.matchAll(/^(\w+)\s*=\s*"(\w+)"/gm)];
        for (const m of sold) expect(m[2], "size and type share a name").toBe(m[1]);
        const names = sold.map((m) => m[1]);
        const boat = provider("boat");
        expect(boat.sizes).toEqual(
            names.length > 0 ? types.filter((t) => names.includes(t.name)) : types,
        );
        const days = /maxTTL\s*=\s*(\d+) \* 24 \* time\.Hour/.exec(go)?.[1];
        expect(boat.lifetimeMinutes).toBe(Number(days) * 24 * 60);
        const caps = goFunc(go, "Capabilities");
        expect(caps).toContain("MaxLifetime: maxTTL");
        expect(caps).toContain(`ExecUser: "${boat.user}"`);
    });

    it("sell E2B's templates cheapest first, for an hour, run as root, in the US", () => {
        const go = read("internal/provider/e2b/e2b.go");
        const templates: Size[] = tomlTables(toml, "e2b.templates").map((t) => ({
            name: t.size as string,
            vcpu: Number(t.vcpu),
            memoryMiB: Number(t.memory_mib),
            diskGiB: Number(t.disk_gib),
        }));
        // The adapter orders them by cost; when each template has at least the vCPU and memory of
        // the one before, any rate gives that order, so no rate is needed here
        const ordered = [...templates].sort((a, b) => a.vcpu - b.vcpu || a.memoryMiB - b.memoryMiB);
        ordered.slice(1).forEach((t, i) => {
            const before = ordered[i] as Size;
            expect(t.vcpu >= before.vcpu && t.memoryMiB >= before.memoryMiB, t.name).toBe(true);
        });
        expect(go).toContain("templates:    byCost(opts.Templates)");
        const e2b = provider("e2b");
        expect(e2b.sizes).toEqual(ordered);
        expect(go).toMatch(/defaultMaxLifetime\s*=\s*time\.Hour\n/);
        expect(e2b.lifetimeMinutes).toBe(60);
        expect(goFunc(go, "Capabilities")).not.toContain("ExecUser");
        expect(read("internal/provider/provider.go")).toContain(
            "ExecUser is the user Exec runs as, root when empty",
        );
        expect(e2b.user).toBe("root");
        // e2b.app is E2B's US-West-1 region; EU-West-1 is another domain
        expect(go).toMatch(/defaultDomain\s*=\s*"e2b\.app"/);
        expect(e2b.location).toBe("United States");
    });

    it("sell boxd's sizes in their written order, with no time limit, run as boxd, in Frankfurt", () => {
        const go = read("internal/provider/boxd/boxd.go");
        const disk = Number(/diskGiB\s*=\s*(\d+)/.exec(go)?.[1]);
        const sizes: Size[] = [
            ...go.matchAll(/provider\.Size\{Name: "(\w+)", Resources: res\((\d+), (\d+)\)\}/g),
        ].map((m) => ({
            name: m[1] as string,
            vcpu: Number(m[2]),
            memoryMiB: Number(m[3]) * 1024,
            diskGiB: disk,
        }));
        const boxd = provider("boxd");
        expect(boxd.sizes).toEqual(sizes);
        const caps = goFunc(go, "Capabilities");
        expect(caps).not.toContain("MaxLifetime");
        expect(boxd.lifetimeMinutes).toBeNull();
        expect(caps).toContain(`ExecUser: "${boxd.user}"`);
        expect(go).toMatch(/defaultRegion\s*=\s*"fra"/);
        expect(boxd.location).toBe("Frankfurt, Germany");
    });

    it("stop a run its slack short of the provider's limit", () => {
        const saga = read("internal/saga/saga.go");
        for (const go of [saga, read("internal/placement/placement.go")]) {
            const slack = /lifetimeSlack\s*=\s*(\d+) \* time\.Minute/.exec(go)?.[1];
            expect(Number(slack)).toBe(lifetimeSlackMinutes);
        }
        const within = goFunc(saga, "withinLifetime");
        expect(within).toContain("life := deadline.Add(lifetimeSlack).Sub(born)");
        expect(within).toContain("life > limit");
    });

    it("never start a package on a size that leaves too little of its price, as refused says", () => {
        // The figures are read here and never written down: what Bugnet pays stays out of the repo
        const config = read("internal/config/config.go");
        const defaults = config.slice(config.indexOf("func defaults() file {"));
        const floor = Number(
            /^margin_floor\s*=\s*([\d.]+)/m.exec(toml)?.[1] ??
                /MarginFloor:\s*([\d.]+),/.exec(defaults)?.[1],
        );
        expect(floor).toBeGreaterThan(0);

        // Placing an order tries every provider's pick with no hold before the paid clock
        const place = read("internal/placement/placement.go");
        expect(place).toContain(
            "billed := time.Duration(pk.Minutes)*time.Minute + max(in.Hold, 0)",
        );
        expect(place).toContain("cost := costMicros(hourly, billed, p.BillingIncrement())");
        expect(place).toContain("margin = float64(pk.PriceMicros-cost) / float64(pk.PriceMicros)");
        expect(place).toContain("if margin < in.MarginFloor {");
        expect(goFunc(read("internal/saga/saga.go"), "inputs")).not.toContain("Hold");

        // Each adapter's hourly cost of a size, in micro-USD
        const boat = read("internal/provider/boat/boat.go");
        const boatRate = new Map(
            [...boat.matchAll(/\{"(\w+)", provider\.Resources\{[^}]*\}, ([\d_]+)\}/g)].map((m) => [
                m[1] as string,
                goInt(m[2]),
            ]),
        );
        expect(goFunc(boat, "HourlyCostMicros")).toContain("return s.typ.hourMicros");
        const e2b = read("internal/provider/e2b/e2b.go");
        const perVcpu = goInt(/vcpuHourMicros\s*=\s*([\d_]+)/.exec(e2b)?.[1]);
        const perGiB = goInt(/gibHourMicros\s*=\s*([\d_]+)/.exec(e2b)?.[1]);
        expect(e2b).toContain(
            "return int64(r.VCPU)*vcpuHourMicros + (int64(r.MemoryMiB)*gibHourMicros+1023)/1024",
        );
        expect(goFunc(e2b, "HourlyCostMicros")).toContain("return hourlyMicros(size.Resources)");
        const boxd = read("internal/provider/boxd/boxd.go");
        const eurRate = new Map(
            [
                ...boxd.matchAll(
                    /provider\.Size\{Name: "(\w+)", Resources: res\(\d+, \d+\)\}, ([\d_]+)\}/g,
                ),
            ].map((m) => [m[1] as string, goInt(m[2])]),
        );
        const usdPerEURCents = goInt(/usdPerEURCents\s*=\s*([\d_]+)/.exec(boxd)?.[1]);
        expect(goFunc(boxd, "HourlyCostMicros")).toContain(
            "return (eur*usdPerEURCents + 99) / 100",
        );
        const hourly: Record<string, (s: Size) => bigint | undefined> = {
            boat: (s) => boatRate.get(s.name),
            e2b: (s) => BigInt(s.vcpu) * perVcpu + (BigInt(s.memoryMiB) * perGiB + 1023n) / 1024n,
            boxd: (s) => {
                const eur = eurRate.get(s.name);
                return eur === undefined ? undefined : (eur * usdPerEURCents + 99n) / 100n;
            },
        };

        // Only Boat charges for a start, and nothing for one within the plan's included starts
        const limits = read("internal/provider/boat/limits.go");
        const brackets = /var startBrackets = \[\]struct \{[^}]*\}\{([^]*?)\n\}/.exec(limits)?.[1];
        const fees = [...(brackets ?? "").matchAll(/\{[\d.]+, ([\d_]+)\}/g)];
        expect(fees.length).toBeGreaterThan(0);
        const leastFee = fees.map((m) => goInt(m[1])).reduce((a, b) => (b < a ? b : a));
        expect(limits).toContain("func (p *Provider) StartCostMicros(");
        for (const id of ["e2b", "boxd"]) {
            const dir = `internal/provider/${id}`;
            for (const file of readdirSync(join(router, dir))) {
                if (file.endsWith(".go") && !file.endsWith("_test.go")) {
                    expect(read(`${dir}/${file}`), file).not.toContain("StartCostMicros");
                }
            }
        }

        const below: string[] = [];
        for (const provider of cloudProviders) {
            const go = read(`internal/provider/${provider.id}/${provider.id}.go`);
            // Billed by the second, and every package lasts whole seconds
            expect(go).toMatch(/BillingIncrement\(\) time\.Duration \{ return time\.Second \}/);
            const fee = provider.id === "boat" ? leastFee : 0n;
            for (const p of catalogPackages()) {
                const size = sizeFor(provider, p);
                if (!size) continue;
                const rate = hourly[provider.id]?.(size);
                expect(rate, `${provider.id} ${size.name}`).toBeDefined();
                const seconds = BigInt(p.minutes * 60);
                const cost = ((rate as bigint) * seconds + 3599n) / 3600n + fee;
                const margin = Number(BigInt(p.priceMicros) - cost) / p.priceMicros;
                if (margin < floor) below.push(`${provider.id} ${size.name} ${p.id}`);
            }
        }
        expect(refused.map((r) => `${r.provider} ${r.size} ${r.package}`)).toEqual(below);
    });
});
