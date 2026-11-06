import { describe, expect, it } from "vitest";
import { copy, type ExitInfo } from "./copy.ts";

describe("copy", () => {
    it("names each way a sandbox ends", () => {
        expect(copy.ended("stopped")).toBe("Ended · stopped");
        expect(copy.ended("deadline")).toBe("Ended · reached its deadline");
        expect(copy.ended("failed")).toBe("Ended · failed to start");
        expect(copy.ended("exited")).toBe("Ended · powered off");
        expect(copy.ended("fault")).toBe("Ended · lost by the provider");
        expect(copy.ended("other")).toBe("Ended");
    });

    it("fills the session row templates", () => {
        expect(copy.started("14:02")).toBe("Started 14:02");
        expect(copy.endedAt("6 Nov 14:12")).toBe("Ended 6 Nov 14:12");
        expect(copy.ends("14:12", "7 min")).toBe("Ends 14:12 (7 min left)");
        expect(copy.deletes("47 h")).toBe("Deleted in 47 h");
    });

    it("formats the byte and count notices", () => {
        expect(copy.cut(1_258_291)).toBe("Earlier output not kept (1.2 MiB)");
        expect(copy.dropped(1000)).toBe("Earlier lines dropped from this view: 1000");
        expect(copy.skipped(12_345)).toBe("12 KiB earlier not shown");
        expect(copy.eventsDropped(120)).toBe("120 more events weren't recorded.");
    });

    it("writes each job's last line", () => {
        const job = (o: Partial<ExitInfo>): ExitInfo => ({
            state: "exited",
            exitCode: 0,
            oom: false,
            peakMib: 0,
            ...o,
        });
        expect(copy.exitLine(job({ exitCode: 1, peakMib: 512 }), 9_200)).toBe(
            "exit 1 · 9.2 s · peak 512 MiB",
        );
        expect(copy.exitLine(job({}), 41_000)).toBe("exit 0 · 41 s");
        expect(copy.exitLine(job({ exitCode: 137, oom: true, peakMib: 2048 }), 41_000)).toBe(
            "killed: out of memory · 41 s",
        );
        expect(copy.exitLine(job({ state: "lost", exitCode: null }), 400)).toBe("lost · 0.4 s");
        expect(copy.exitLine(job({ state: "cancelled", exitCode: null }), 243_000)).toBe(
            "cancelled · 4 min 3 s",
        );
        expect(copy.exitLine(job({ state: "running", exitCode: null }), 1_000)).toBeNull();
    });

    it("names the map's nodes and metrics", () => {
        expect(copy.nodes.preview(3000)).toBe("Preview :3000");
        expect(copy.nodes.moreHosts(15)).toBe("+15 more hosts");
        expect(copy.nodes.morePorts(3)).toBe("+3 more ports");
        expect(copy.nodes.moreHosts(1)).toBe("+1 more hosts");
        expect(copy.nodes.morePorts(1)).toBe("+1 more ports");
        expect(copy.metrics.toolCalls(1)).toBe("1 tool call");
        expect(copy.metrics.toolCalls(7)).toBe("7 tool calls");
        expect(copy.metrics.paid(75_000)).toBe("0.075 USDC paid");
        expect(copy.metrics.paid(50_000, 20_000)).toBe("0.05 USDC paid · 0.02 USDC refunded");
        expect(copy.metrics.requests(2)).toBe("2 requests");
        expect(copy.metrics.calls(1)).toBe("1 call");
        expect(copy.metrics.usdc(3_000)).toBe("0.003 USDC");
        expect(copy.metrics.sessions(1)).toBe("1 session");
        expect(copy.metrics.files(2)).toBe("2 files");
        expect(copy.metrics.refused(4)).toBe("4 refused");
    });

    it("keeps the exact page text", () => {
        expect(copy.title).toBe("Bugnet sandbox session");
        expect(copy.gateTip).toBe(
            "Nothing loads until you click. Share this link only with people who may see its output.",
        );
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
            "Time",
            "Out",
            "Err",
        ]);
        expect(Object.values(copy.eventsHead)).toEqual([
            "Time",
            "Event",
            "Detail",
            "Amount",
            "Transaction",
        ]);
    });
});
