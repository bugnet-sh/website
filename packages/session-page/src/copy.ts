import { formatBytes, formatDuration, formatUsdc, plural } from "./format.ts";
import type { EndedBecause, JobState, X402Status } from "./payload.ts";

const endedReason: Record<EndedBecause, string> = {
    stopped: "stopped",
    deadline: "reached its deadline",
    failed: "failed to start",
    exited: "powered off",
    fault: "lost by the provider",
    other: "",
};

// Every template that joins parts uses it, and the map measures its label lines with it
const SEP = " · ";

export interface ExitInfo {
    state: JobState;
    exitCode: number | null;
    oom: boolean;
    peakMib: number;
}

// Byte and count parameters take numbers, while times come formatted, since they need the clock
export const copy = {
    SEP,
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
        because === "other" ? "Ended" : `Ended${SEP}${endedReason[because]}`,
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
    copyFailed: "Copy failed",
    tipMark: "?",
    noCommand: "(command not recorded)",
    // Ends the one line a multi-line command shows in its table cell
    moreLines: " …",
    // A count the page was never given, such as the bytes of a job the provider lost
    noValue: "—",
    exitCell: {
        oom: "OOM",
        lost: "lost",
        cancelled: "cancelled",
        running: "running",
    },

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
    outputLabel: (seq: number) => `Output of command ${seq}`,
    // Null while the job runs, since it has no last line yet
    exitLine: (job: ExitInfo, durationMs: number): string | null => {
        const took = formatDuration(durationMs);
        if (job.oom) return `killed: out of memory${SEP}${took}`;
        if (job.state === "lost") return `lost${SEP}${took}`;
        if (job.state === "cancelled") return `cancelled${SEP}${took}`;
        if (job.state === "running") return null;
        const peak = job.peakMib > 0 ? `${SEP}peak ${job.peakMib} MiB` : "";
        if (job.exitCode === null) return `${took}${peak}`;
        return `exit ${job.exitCode}${SEP}${took}${peak}`;
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
        paid: (micros: number) => `${formatUsdc(micros)} paid`,
        refunded: (micros: number) => `${formatUsdc(micros)} refunded`,
        requests: (n: number) => plural(n, "request", "requests"),
        calls: (n: number) => plural(n, "call", "calls"),
        usdc: (micros: number) => formatUsdc(micros),
        sessions: (n: number) => plural(n, "session", "sessions"),
        files: (n: number) => plural(n, "file", "files"),
        refused: (n: number) => `${n} refused`,
    },

    spec: {
        vcpu: (n: number) => `${n} vCPU`,
        memory: (mib: number) => (mib % 1024 === 0 ? `${mib / 1024} GiB` : `${mib} MiB`),
        disk: (gib: number) => `${gib} GiB disk`,
        minutes: (n: number) => `${n} min`,
    },

    rows: {
        placed: "Placed",
        ready: "Ready",
        extended: "Extended",
        ended: "Ended",
        extendedBy: (minutes: number) => `+${minutes} min`,
        until: (time: string) => `until ${time}`,
        startPayment: "Start payment",
        extendPayment: "Extension payment",
        allowancePaid: "Allowance paid",
        allowanceRefunded: "Allowance refunded",
        jobStarted: (seq: number) => `Command #${seq} started`,
        jobEnded: (seq: number) => `Command #${seq} ended`,
        exit: (code: number) => `exit ${code}`,
        oom: "killed: out of memory",
        file: (op: string) => `File ${op}`,
        previewIssued: "Preview issued",
        previewRevoked: "Preview revoked",
        requests: "Requests",
        port: (port: number) => `port ${port}`,
        upload: "Upload",
        download: "Download",
        sshStarted: "SSH session started",
        sshEnded: "SSH session ended",
        sshBytes: (bytesIn: number, bytesOut: number) =>
            `${formatBytes(bytesIn)} in${SEP}${formatBytes(bytesOut)} out`,
        x402: {
            paid: "paid",
            free: "free",
            refused_cap: "refused: allowance used up",
            refused_price: "refused: price above the cap",
            refused_host: "refused: host not registered",
            upstream_error: "upstream error",
        } satisfies Record<X402Status, string>,
    },

    footer: {
        terms: "Terms",
        privacy: "Privacy",
        reportAbuse: "Report abuse",
    },
} as const;
