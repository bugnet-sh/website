import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cloudProviders, type CloudProvider, type Size } from "./servers";

// The router's repository, when it is checked out beside this one
const router = join(__dirname, "../../../../../bugnet-router");
const read = (path: string) => readFileSync(join(router, path), "utf8");

function provider(id: string): CloudProvider {
    const p = cloudProviders.find((c) => c.id === id);
    if (!p) throw new Error(`no provider ${id}`);
    return p;
}

/** The text of a Go function, from its signature to the closing brace at the line's start */
function goFunc(source: string, name: string): string {
    const at = source.indexOf(`) ${name}(`);
    expect(at, name).toBeGreaterThan(-1);
    return source.slice(at, source.indexOf("\n}", at));
}

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
        // No [boat] types, no [e2b] domain or lifetime, no [boxd] region
        expect(toml).not.toMatch(/^\[(boat|boxd|e2b)\]/m);
        expect(toml).not.toMatch(/^\[boat\.types\]/m);
    });

    it("sell Boat's machine types in their written order, for 30 days, run as user", () => {
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
        const boat = provider("boat");
        expect(boat.sizes).toEqual(types);
        const days = /maxTTL\s*=\s*(\d+) \* 24 \* time\.Hour/.exec(go)?.[1];
        expect(boat.lifetimeHours).toBe(Number(days) * 24);
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
        expect(e2b.lifetimeHours).toBe(1);
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
        expect(boxd.lifetimeHours).toBeNull();
        expect(caps).toContain(`ExecUser: "${boxd.user}"`);
        expect(go).toMatch(/defaultRegion\s*=\s*"fra"/);
        expect(boxd.location).toBe("Frankfurt, Germany");
    });
});
