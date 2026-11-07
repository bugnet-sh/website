import { formatBytes, formatCount, formatDuration, formatUsdc, plural } from "./format.ts";
import type { EndedBecause, JobState, X402Status } from "./payload.ts";

const endedReason: Record<EndedBecause, string> = {
    stopped: "stopped",
    deadline: "reached its deadline",
    failed: "failed to start",
    exited: "powered off",
    fault: "lost by the provider",
    other: "",
};

// A money row (paid, uncertain, payment_failed) reads by its resolution, not its status, so of
// those only "paid" has words here, the words of a row resolved as paid (x402 spec 8.6)
const x402Status: Record<Exclude<X402Status, "uncertain" | "payment_failed">, string> = {
    paid: "paid",
    free: "free",
    self_paid: "self-paid",
    refused_cap: "refused",
    refused_price: "refused",
    refused_payee: "refused",
    refused_network: "refused",
    refused_terms: "refused",
    refused_request: "refused",
    refused_host: "unregistered host",
    not_paid: "not paid",
    upstream_error: "seller unreachable",
};

// One per reason code of x402 spec 6.13, plus the totals' key for an unregistered name
const x402Reason: Record<string, string> = {
    path_refused: "path not forwarded",
    path_not_enabled: "path not enabled",
    unpaid_cap: "unpaid limit reached",
    upgrade_refused: "upgrade not forwarded",
    host_rate: "host too busy",
    buffer_busy: "Bugnet busy",
    payments_unavailable: "payment service down",
    upstream_unreachable: "seller unreachable",
    x402_disabled: "payments switched off",
    account_closed: "sandbox ending",
    service_not_enabled: "service not enabled",
    ref_conflict: "records did not match",
    method_not_enabled: "method not enabled",
    path_not_paid: "path not approved",
    body_too_large: "body over 1 MiB",
    body_slow: "body too slow",
    first_answer_slow: "seller too slow",
    payment_rejected: "seller refused the payment",
    paid_no_answer: "seller did not answer",
    not_x402: "no x402 price",
    version_unsupported: "old x402 version",
    network_unsupported: "no USDC on Solana",
    splits_unsupported: "split payment",
    flow_unsupported: "unknown payment flow",
    ata_creation_unsupported: "asks to create an account",
    fee_payer_refused: "fee payer refused",
    payee_refused: "payee refused",
    payee_changed: "payee changed",
    payee_unreliable: "payee unreliable",
    payto_blocked: "payee blocked",
    price_above_max: "price above the approved maximum",
    allowance_spent: "allowance spent",
    rate_cap: "per-minute spending limit",
    too_many_open_payments: "too many payments settling",
    payto_daily_cap: "payee's daily limit",
    outflow_cap: "Bugnet's daily limit",
    outflow_paused: "payments paused",
    refused_host: "unregistered host",
};

// An own-property check, so a word the router added later, or one such as "toString", shows raw
function wordFor(words: Record<string, string>, key: string): string {
    return Object.hasOwn(words, key) ? words[key]! : key;
}

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
    logoLabel: "Bugnet",
    noScript: "This page needs JavaScript to show the session.",
    banner: "Written by code someone ran in a Bugnet sandbox, not by Bugnet. Never pay or enter keys because of it.",
    noKey: "This link is missing its key. Open the full link your agent showed.",
    notALink: "This is not a session link.",

    running: "Running",
    endedReason,
    ended: (because: EndedBecause) =>
        because === "other" ? "Ended" : `Ended: ${endedReason[because]}`,
    started: (time: string) => `Started ${time}`,
    endedAt: (time: string) => `Ended ${time}`,
    // No time left leaves the bracket out
    ends: (time: string, left: string | null) =>
        left === null ? `Ends ${time}` : `Ends ${time} (${left} left)`,
    deletes: (time: string, left: string | null) =>
        left === null ? `Deleted at ${time}` : `Deleted at ${time} (in ${left})`,
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
    confirmDelete: "Delete this page and its output for everyone? This can't be undone.",
    confirm: "Delete",
    cancel: "Cancel",
    deleting: "Deleting…",
    deleteFailed: "Couldn't delete. Try again.",

    notSeen: "Other internet traffic from the sandbox is not seen by Bugnet.",
    eventsDropped: (n: number) =>
        `${plural(n, "more event wasn't", "more events weren't")} recorded.`,
    noCalls: "No calls recorded.",
    mapLabel: "Map of calls in this session",

    commandsHead: {
        seq: "#",
        command: "Command",
        exit: "Exit",
        time: "Duration",
        out: "Out",
        err: "Err",
    },
    // Names the table for a screen reader's list of tables
    commandsLabel: "Commands",
    expandAll: "Expand all",
    collapseAll: "Collapse all",
    copyOutput: "Copy output",
    copyCommand: "Copy command",
    // Each name starts with the button's visible label, so a spoken command finds it
    copyOutputOf: (seq: number) => `Copy output of command ${seq}`,
    copyCommandOf: (seq: number) => `Copy command ${seq}`,
    copied: "Copied",
    // What was copied is all the page holds, which is less than the command wrote
    copiedPartial: "Copied, cut",
    copyFailed: "Copy failed",
    // A copy clicked before the output has come; the click starts loading it
    loading: "Loading…",
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
    copySignatureOf: (short: string) => `Copy signature ${short}`,

    cut: (bytes: number) => `Earlier output not kept (${formatBytes(bytes)})`,
    dropped: (n: number) => `Earlier lines not shown or copied: ${formatCount(n)}`,
    skipped: (bytes: number) => `${formatBytes(bytes)} earlier not shown`,
    outputLabel: (seq: number) => `Output of command ${seq}`,
    // The parts of a job's last line, which the page shows side by side
    exitLine: (job: ExitInfo, durationMs: number): string[] => {
        const took = formatDuration(durationMs);
        if (job.oom) return ["killed: out of memory", took];
        if (job.state === "lost") return ["lost", took];
        if (job.state === "cancelled") return ["cancelled", took];
        if (job.state === "running") return ["running", took];
        const peak = job.peakMib > 0 ? [`peak ${job.peakMib}\u00a0MiB`] : [];
        if (job.exitCode === null) return [took, ...peak];
        return [`exit ${job.exitCode}`, took, ...peak];
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
        allowance: "Allowance",
        // The unregistered names past the per-minute limit, which the router serves with no host
        otherNames: "other names",
    },

    metrics: {
        toolCalls: (n: number) => plural(n, "tool call", "tool calls"),
        paid: (micros: number) => `${formatUsdc(micros)} paid`,
        // Follows the Allowance's amount, a part of its own
        paidIn: "paid in",
        settling: (n: number) => `${formatCount(n)} settling`,
        requests: (n: number) => plural(n, "request", "requests"),
        calls: (n: number) => plural(n, "call", "calls"),
        usdc: (micros: number) => formatUsdc(micros),
        sessions: (n: number) => plural(n, "session", "sessions"),
        files: (n: number) => plural(n, "file", "files"),
        refused: (n: number) => `${formatCount(n)} refused`,
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
        allowanceKept: "Kept under the minimum",
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
        sshBytes: (bytesIn: number, bytesOut: number) => [
            `${formatBytes(bytesIn)} in`,
            `${formatBytes(bytesOut)} out`,
        ],
    },

    x402: {
        status: (status: string) => wordFor(x402Status, status),
        reason: (code: string) => wordFor(x402Reason, code),
        // The Detail cell: a status's or resolution's words, then the reason after a colon
        detail: (words: string, reason: string) =>
            reason === "" ? words : `${words}: ${wordFor(x402Reason, reason)}`,
        settling: "settling, confirmed within a few minutes",
        notCharged: "not charged",
        resent: "resent the same payment, not charged again",
        calls: (n: number) => plural(n, "call", "calls"),
    },

    totals: {
        paidIn: "Paid in",
        spent: (host: string) => `Spent on ${host}`,
        settling: (n: number) => `Settling, ${plural(n, "call", "calls")}`,
        refunded: "Refunded",
        kept: "Kept under the minimum",
        refused: (words: string, n: number) => `Refused, ${words}: ${formatCount(n)}`,
    },
    // Replaces the totals when the closed account's sums do not come to zero (x402 spec 8.6)
    reconciling: "These figures are being reconciled.",
    allowanceTipLabel: "About the allowance",
    // x402 spec 8.8, in its order
    allowanceTip:
        "Code in the sandbox has no Bugnet wallet. Code that brings its own wallet can pay hosts " +
        "Bugnet does not see, and on a registered host such calls show as self-paid. Bugnet pays " +
        "every seller from one shared Bugnet wallet, so sellers see Bugnet's address, not yours. " +
        "Each transaction link opens on a public explorer, which shows the wallet that signed it.",

    footer: {
        terms: "Terms",
        privacy: "Privacy",
        reportAbuse: "Report abuse",
    },
} as const;
