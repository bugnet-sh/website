import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { copy, type ExitInfo } from "./copy.ts";

// Every space in a byte count or a duration is a no-break space
const nb = (s: string) => s.replaceAll(" ", "\u00a0");

// The page's own code, which is all of src but the sample data the tests use
function pageFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const path = join(dir, e.name);
        if (e.isDirectory()) return e.name === "testing" ? [] : pageFiles(path);
        return [path];
    });
}

describe("copy", () => {
    it("names each way a sandbox ends, its reason after a colon", () => {
        expect(copy.ended("stopped")).toBe("Ended: stopped");
        expect(copy.ended("deadline")).toBe("Ended: reached its deadline");
        expect(copy.ended("failed")).toBe("Ended: failed to start");
        expect(copy.ended("exited")).toBe("Ended: powered off");
        expect(copy.ended("fault")).toBe("Ended: lost by the provider");
        expect(copy.ended("other")).toBe("Ended");
    });

    it("fills the session row templates", () => {
        expect(copy.started("14:02")).toBe("Started 14:02");
        expect(copy.endedAt("6 Nov 14:12")).toBe("Ended 6 Nov 14:12");
        expect(copy.ends("14:12", "7 min")).toBe("Ends 14:12 (7 min left)");
        expect(copy.deletes("10:00", "47 h")).toBe("Deleted at 10:00 (in 47 h)");
        expect(copy.deletes("9 Nov 10:00", "47 h")).toBe("Deleted at 9 Nov 10:00 (in 47 h)");
    });

    it("leaves out the time left once none is left, so no line says now left", () => {
        expect(copy.ends("14:12", null)).toBe("Ends 14:12");
        expect(copy.deletes("10:00", null)).toBe("Deleted at 10:00");
    });

    it("formats the byte and count notices", () => {
        expect(copy.cut(1_258_291)).toBe("Earlier output not kept (1.2\u00a0MiB)");
        expect(copy.dropped(1000)).toBe("Earlier lines not shown or copied: 1,000");
        expect(copy.dropped(12_345)).toBe("Earlier lines not shown or copied: 12,345");
        expect(copy.skipped(12_345)).toBe("12\u00a0KiB earlier not shown");
        expect(copy.eventsDropped(120)).toBe("120 more events weren't recorded.");
        expect(copy.eventsDropped(1)).toBe("1 more event wasn't recorded.");
        expect(copy.eventsDropped(1_200)).toBe("1,200 more events weren't recorded.");
        expect(copy.metrics.refused(12_345)).toBe("12,345 refused");
        expect(copy.metrics.requests(12_345)).toBe("12,345 requests");
    });

    it("writes each job's last line as its parts", () => {
        const job = (o: Partial<ExitInfo>): ExitInfo => ({
            state: "exited",
            exitCode: 0,
            oom: false,
            peakMib: 0,
            ...o,
        });
        expect(copy.exitLine(job({ exitCode: 1, peakMib: 512 }), 9_200)).toEqual([
            "exit 1",
            "9.2\u00a0s",
            "peak 512\u00a0MiB",
        ]);
        expect(copy.exitLine(job({}), 41_000)).toEqual(["exit 0", nb("41 s")]);
        expect(copy.exitLine(job({ exitCode: 137, oom: true, peakMib: 2048 }), 41_000)).toEqual([
            "killed: out of memory",
            nb("41 s"),
        ]);
        expect(copy.exitLine(job({ state: "lost", exitCode: null }), 400)).toEqual([
            "lost",
            nb("0.4 s"),
        ]);
        expect(copy.exitLine(job({ state: "cancelled", exitCode: null }), 243_000)).toEqual([
            "cancelled",
            nb("4 min 3 s"),
        ]);
    });

    it("says a running job is running, with its time so far", () => {
        const running: ExitInfo = { state: "running", exitCode: null, oom: false, peakMib: 0 };
        expect(copy.exitLine(running, 62_000)).toEqual(["running", nb("1 min 2 s")]);
    });

    it("leaves the exit part out of an exited job's line when it has no code", () => {
        const job: ExitInfo = { state: "exited", exitCode: null, oom: false, peakMib: 512 };
        expect(copy.exitLine(job, 9_200)).toEqual([nb("9.2 s"), "peak 512\u00a0MiB"]);
        expect(copy.exitLine({ ...job, peakMib: 0 }, 9_200)).toEqual([nb("9.2 s")]);
    });

    it("names the map's nodes and metrics", () => {
        expect(copy.nodes.preview(3000)).toBe("Preview :3000");
        expect(copy.nodes.moreHosts(15)).toBe("+15 more hosts");
        expect(copy.nodes.morePorts(3)).toBe("+3 more ports");
        expect(copy.nodes.moreHosts(1)).toBe("+1 more host");
        expect(copy.nodes.morePorts(1)).toBe("+1 more port");
        expect(copy.nodes.morePorts(2)).toBe("+2 more ports");
        expect(copy.metrics.toolCalls(1)).toBe("1 tool call");
        expect(copy.metrics.toolCalls(7)).toBe("7 tool calls");
        expect(copy.metrics.paid(75_000)).toBe("0.075 USDC paid");
        expect(copy.metrics.refunded(20_000)).toBe("0.02 USDC refunded");
        expect(copy.metrics.requests(2)).toBe("2 requests");
        expect(copy.metrics.calls(1)).toBe("1 call");
        expect(copy.metrics.usdc(3_000)).toBe("0.003 USDC");
        expect(copy.metrics.sessions(1)).toBe("1 session");
        expect(copy.metrics.files(2)).toBe("2 files");
        expect(copy.metrics.refused(4)).toBe("4 refused");
    });

    it("keeps parts that sit side by side apart, never joined by a separator", () => {
        expect("SEP" in copy).toBe(false);
        expect(copy.rows.sshBytes(1_024, 2_048)).toEqual(["1\u00a0KiB in", "2\u00a0KiB out"]);
    });

    it("never writes a middle dot anywhere in the page's code", () => {
        const files = pageFiles(fileURLToPath(new URL(".", import.meta.url)));
        expect(files.some((f) => f.endsWith("copy.ts"))).toBe(true);
        for (const file of files) {
            expect(readFileSync(file, "utf8").includes("\u00b7"), file).toBe(false);
        }
    });

    it("keeps the exact page text", () => {
        expect(copy.title).toBe("Bugnet sandbox session");
        expect(copy.logoLabel).toBe("Bugnet");
        expect(copy.noScript).toBe("This page needs JavaScript to show the session.");
        expect(copy.copyFailed).toBe("Copy failed");
        expect(copy.copiedPartial).toBe("Copied, cut");
        expect(copy.loading).toBe("Loading…");
        expect(copy.copyCommand).toBe("Copy command");
        expect(copy.confirmDelete).toBe(
            "Delete this page and its output for everyone? This can't be undone.",
        );
        expect(copy.tipMark).toBe("?");
        expect(copy.expired).toBe(
            "This page has expired. Session pages are deleted 48 hours after the sandbox ends.",
        );
        expect(copy.notFound).toBe(
            "This link doesn't work. It may be wrong, deleted, or replaced by a newer link.",
        );
        expect(copy.banner).toBe(
            "Written by code someone ran in a Bugnet sandbox, not by Bugnet. Never pay or enter keys because of it.",
        );
        expect(Object.values(copy.commandsHead)).toEqual([
            "#",
            "Command",
            "Exit",
            "Duration",
            "Out",
            "Err",
        ]);
        expect(Object.values(copy.exitCell)).toEqual(["OOM", "lost", "cancelled", "running"]);
        expect(copy.noCommand).toBe("(command not recorded)");
        expect(copy.noValue).toBe("—");
        expect(copy.moreLines).toBe(" …");
        expect(copy.outputLabel(3)).toBe("Output of command 3");
        expect(Object.values(copy.eventsHead)).toEqual([
            "Time",
            "Event",
            "Detail",
            "Amount",
            "Transaction",
        ]);
    });
});
