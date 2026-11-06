import { formatBytes, formatDuration, formatUsdc, plural } from "./format.ts";
import type { EndedBecause, JobState } from "./payload.ts";

const endedReason: Record<EndedBecause, string> = {
    stopped: "stopped",
    deadline: "reached its deadline",
    failed: "failed to start",
    exited: "powered off",
    fault: "lost by the provider",
    other: "",
};

export interface ExitInfo {
    state: JobState;
    exitCode: number | null;
    oom: boolean;
    peakMib: number;
}

// Byte and count parameters take numbers, while times come formatted, since they need the clock
export const copy = {
    title: "Bugnet sandbox session",
    heading: "Sandbox session",
    banner: "Written by code someone ran in a Bugnet sandbox, not by Bugnet. Never pay or enter keys because of it.",
    gateTip:
        "Nothing loads until you click. Share this link only with people who may see its output.",
    showOutput: "Show output",
    loading: "Loading…",
    noKey: "This link is missing its key. Open the full link your agent showed.",
    notALink: "This is not a session link.",

    running: "Running",
    endedReason,
    ended: (because: EndedBecause) =>
        because === "other" ? "Ended" : `Ended · ${endedReason[because]}`,
    started: (time: string) => `Started ${time}`,
    endedAt: (time: string) => `Ended ${time}`,
    ends: (time: string, left: string) => `Ends ${time} (${left} left)`,
    deletes: (left: string) => `Deleted in ${left}`,
    mapLater: "The map appears when the sandbox ends.",
    sandboxEnded: "Sandbox ended",

    savingOutput: "Saving output…",
    outputExpired: "The output expired before it was saved.",
    outputPartial: "Some output could not be saved.",

    expired: "This page has expired. Session pages are deleted 48 hours after the sandbox ends.",
    notFound: "This link doesn't work. It may be wrong, deleted, or replaced by a newer link.",
    deleted: "Deleted. This page and its output are gone for everyone.",
    rateLimited: "Too many tries from your network. Wait a few minutes, then try again.",
    offline: "Couldn't reach Bugnet.",
    retry: "Try again",
    reconnecting: "Reconnecting…",
    tooNew: "This page needs a newer version. Reload it.",

    deleteNow: "Delete now",
    confirmDelete: "Delete for everyone? This can't be undone.",
    confirm: "Delete",
    cancel: "Cancel",
    deleting: "Deleting…",
    deleteFailed: "Couldn't delete. Try again.",

    notSeen: "Other internet traffic from the sandbox is not seen by Bugnet.",
    eventsDropped: (n: number) => `${n} more events weren't recorded.`,
    noCalls: "No calls recorded.",
    mapLabel: "Map of calls in this session",

    commandsHead: {
        seq: "#",
        command: "Command",
        exit: "Exit",
        time: "Time",
        out: "Out",
        err: "Err",
    },
    expandAll: "Expand all",
    collapseAll: "Collapse all",
    copyOutput: "Copy output",
    copied: "Copied",

    eventsHead: {
        time: "Time",
        event: "Event",
        detail: "Detail",
        amount: "Amount",
        tx: "Transaction",
    },
    openInExplorer: "Open in explorer",
    copySignature: "Copy signature",

    cut: (bytes: number) => `Earlier output not kept (${formatBytes(bytes)})`,
    dropped: (n: number) => `Earlier lines dropped from this view: ${n}`,
    skipped: (bytes: number) => `${formatBytes(bytes)} earlier not shown`,
    // Null while the job runs, since it has no last line yet
    exitLine: (job: ExitInfo, durationMs: number): string | null => {
        const took = formatDuration(durationMs);
        if (job.oom) return `killed: out of memory · ${took}`;
        if (job.state === "lost") return `lost · ${took}`;
        if (job.state === "cancelled") return `cancelled · ${took}`;
        if (job.state === "running") return null;
        const peak = job.peakMib > 0 ? ` · peak ${job.peakMib} MiB` : "";
        return `exit ${job.exitCode ?? "?"} · ${took}${peak}`;
    },
    waiting: "Waiting for a free stream…",
    limit: "Live output limit reached for this sandbox.",

    nodes: {
        sandbox: "Sandbox",
        mcp: "Bugnet MCP",
        payments: "Payments",
        ssh: "SSH",
        transfers: "Transfers",
        preview: (port: number) => `Preview :${port}`,
        moreHosts: (n: number) => `+${plural(n, "more host", "more hosts")}`,
        morePorts: (n: number) => `+${plural(n, "more port", "more ports")}`,
    },

    metrics: {
        toolCalls: (n: number) => plural(n, "tool call", "tool calls"),
        paid: (paidMicros: number, refundedMicros = 0) =>
            refundedMicros > 0
                ? `${formatUsdc(paidMicros)} paid · ${formatUsdc(refundedMicros)} refunded`
                : `${formatUsdc(paidMicros)} paid`,
        requests: (n: number) => plural(n, "request", "requests"),
        calls: (n: number) => plural(n, "call", "calls"),
        usdc: (micros: number) => formatUsdc(micros),
        sessions: (n: number) => plural(n, "session", "sessions"),
        files: (n: number) => plural(n, "file", "files"),
        refused: (n: number) => `${n} refused`,
    },

    footer: {
        terms: "Terms",
        privacy: "Privacy",
        reportAbuse: "Report abuse",
    },
} as const;
