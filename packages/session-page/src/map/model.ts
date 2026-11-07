/**
 * Turns a session record into the bubble map's nodes (session-page-ui.md 5).
 *
 * The sandbox sits in the centre. Bugnet's own services go left (MCP, Payments, then the
 * Allowance), the hosts that egress sees go right, busiest first, and the ways in go along the
 * bottom (previews by port, then SSH, then transfers). Past MAX_RIGHT hosts or MAX_PREVIEWS ports,
 * the rest fold into one "+N more" node, whose rows name their host or port. Each node carries its
 * table rows, already written as page text and sorted by time.
 *
 * x402 money is read as the router serves it, never joined or inferred (x402 spec 8.3, 8.6): only
 * `resolved: "paid"` is paid, a resent row carries no money, and every count sums `count`.
 */
import { copy } from "../copy.ts";
import { formatBytes, formatClock, formatDuration, truncateLabel } from "../format.ts";
import type {
    AllowanceEvent,
    EndedBecause,
    PaymentEvent,
    PlacementEvent,
    PreviewEvent,
    SessionEvent,
    SessionRecord,
    SshEvent,
    TransferEvent,
    X402Event,
} from "../payload.ts";

export type NodeKind =
    | "sandbox"
    | "mcp"
    | "payments"
    | "allowance"
    | "secret-host"
    | "x402-host"
    // An unregistered name a connection asked for, every call to it refused
    | "refused-host"
    | "preview"
    | "ssh"
    | "transfers"
    | "more-right"
    | "more-bottom";
export type Side = "center" | "left" | "right" | "bottom";
export type Tone = "normal" | "bad" | "warn";

export interface EventRow {
    at: Date;
    event: string;
    // Shown side by side, each part whole
    detail: string[];
    amountMicros: number | null;
    // A settling amount is muted: the seller's word alone never makes it money
    amountTone: "money" | "muted" | null;
    tx: string | null;
    tone: Tone;
}

// Only a non-zero amount is money, so a count beside it never takes the money colour
export interface MetricPart {
    text: string;
    // A sum of USDC rather than a count, which a short form keeps
    amount: boolean;
    money: boolean;
}

export interface MapNode {
    id: string;
    kind: NodeKind;
    side: Side;
    label: string;
    fullLabel: string;
    count: number;
    metricParts: MetricPart[];
    paidMicros: number;
    // Calls whose payment Payments has not resolved yet
    settling: number;
    refused: number;
    rows: EventRow[];
}

export interface AllowanceTotals {
    paidInMicros: number;
    // Largest first
    spent: { host: string; micros: number }[];
    settling: { calls: number; micros: number };
    refunded: { micros: number; tx: string | null } | null;
    keptMicros: number | null;
    // Most first
    refusedByReason: { key: string; words: string; calls: number }[];
    // The closed account's sums do not come to zero, so the page shows no totals
    reconciling: boolean;
}

export interface MapModel {
    nodes: MapNode[];
    empty: boolean;
    eventsDropped: number;
    allowance: AllowanceTotals | null;
}

// The map and its phone list share one selection
export interface MapSelect {
    selectedId: string | null;
    // Called with the selected id again on Escape, so the page closes its table
    onSelect(id: string): void;
    // The id of the element a selection opens, for each bubble's aria-controls
    controls?: string;
}

export const MAX_RIGHT = 6;
export const MAX_PREVIEWS = 4;

// The edges that show refusals are hidden from screen readers, so the name says them
export function accessibleName(node: MapNode): string {
    const refused = node.refused > 0 ? [copy.metrics.refused(node.refused)] : [];
    return [node.fullLabel, ...node.metricParts.map((p) => p.text), ...refused].join(", ");
}

function parts(list: (string | null)[]): string[] {
    return list.filter((p): p is string => p !== null && p !== "");
}

/* Rows */

interface RowContext {
    endedAt: Date;
    endedBecause: EndedBecause;
    // A folded node mixes hosts or ports, so its rows say which
    folded: boolean;
}

/* x402 money (x402 spec 8.2, 8.6) */

// Bugnet signed a payment on these, so they read by their resolution
const MONEY_STATUSES: readonly string[] = ["paid", "uncertain", "payment_failed"];

// Listed rather than "all but": a status the router adds later stays neutral until named (R9)
const REFUSED_STATUSES: readonly string[] = [
    "refused_cap",
    "refused_price",
    "refused_payee",
    "refused_network",
    "refused_terms",
    "refused_request",
    "refused_host",
    "not_paid",
    "upstream_error",
];

// The seller's "paid" is only its word; Payments' resolution makes it so
function isPaid(e: X402Event): boolean {
    return e.resolved === "paid" && !e.resent;
}

function isSettling(e: X402Event): boolean {
    return MONEY_STATUSES.includes(e.status) && e.resolved === null && !e.resent;
}

function isRefused(e: X402Event): boolean {
    return REFUSED_STATUSES.includes(e.status);
}

// A row with no reason, such as an unregistered name, counts under its status
function refusalKey(e: X402Event): string {
    if (e.status === "refused_host" || e.reason === "") return e.status;
    return e.reason;
}

// The router serves the names past its per-minute limit as one row with no host
function hostName(host: string): string {
    return host === "" ? copy.nodes.otherNames : host;
}

function x402Words(e: X402Event): string {
    const words = copy.x402;
    if (e.resent) return words.resent;
    if (e.resolved === "paid") return words.status("paid");
    if (e.resolved === "released") return words.notCharged;
    if (MONEY_STATUSES.includes(e.status)) return words.settling;
    return words.status(e.status);
}

function x402Row(row: EventRow, e: X402Event, ctx: RowContext): void {
    const words = x402Words(e);
    // A folded row's method and path are only its first call's
    const call = [e.method, e.path].filter((p) => p !== "").join(" ");
    row.event = e.count > 1 ? copy.x402.calls(e.count) : call || words;
    row.detail = parts([ctx.folded ? hostName(e.host) : null, copy.x402.detail(words, e.reason)]);
    if (isRefused(e)) row.tone = "warn";
    if (isPaid(e)) {
        row.amountMicros = e.amountMicros;
        row.amountTone = "money";
        row.tx = e.tx ?? null;
    } else if (isSettling(e)) {
        row.amountMicros = e.amountMicros;
        row.amountTone = "muted";
    }
}

export function settlingCalls(events: SessionEvent[]): number {
    let calls = 0;
    for (const e of events) if (e.kind === "x402" && isSettling(e)) calls += e.count;
    return calls;
}

// Payments writes the refund or kept row only after the last payment resolves
export function allowanceOpen(events: SessionEvent[]): boolean {
    const totals = allowanceTotals(events);
    return totals !== null && !accountClosed(totals);
}

function specParts(e: PlacementEvent, minutes: number | undefined): (string | null)[] {
    const spec = copy.spec;
    return [
        e.vcpu === undefined ? null : spec.vcpu(e.vcpu),
        e.memoryMib === undefined ? null : spec.memory(e.memoryMib),
        e.diskGib === undefined ? null : spec.disk(e.diskGib),
        minutes === undefined ? null : spec.minutes(minutes),
    ];
}

function placementText(e: PlacementEvent, ctx: RowContext): [string, string[]] {
    const t = copy.rows;
    switch (e.phase) {
        case "placed":
            return [t.placed, parts(specParts(e, e.minutes))];
        case "ready":
            return [t.ready, []];
        case "extended": {
            const by = e.minutes === undefined ? null : t.extendedBy(e.minutes);
            const until = e.deadline ? t.until(formatClock(e.deadline, ctx.endedAt)) : null;
            return [t.extended, parts([by, until])];
        }
        case "ended":
            return [t.ended, parts([copy.endedReason[e.endedBecause ?? ctx.endedBecause]])];
    }
}

function jobEndDetail(exitCode: number | undefined, oom: boolean, durationMs?: number): string[] {
    const took = durationMs === undefined ? null : formatDuration(durationMs);
    if (oom) return parts([copy.rows.oom, took]);
    return parts([exitCode === undefined ? null : copy.rows.exit(exitCode), took]);
}

function rowFor(e: SessionEvent, ctx: RowContext): EventRow {
    const t = copy.rows;
    const row: EventRow = {
        at: e.at,
        event: "",
        detail: [],
        amountMicros: null,
        amountTone: null,
        tx: null,
        tone: "normal",
    };
    switch (e.kind) {
        case "placement":
            [row.event, row.detail] = placementText(e, ctx);
            break;
        case "payment":
            row.event = e.payKind === "start" ? t.startPayment : t.extendPayment;
            row.amountMicros = e.amountMicros;
            row.amountTone = "money";
            row.tx = e.tx;
            break;
        case "allowance":
            row.amountTone = "money";
            if (e.phase === "kept") {
                row.event = t.allowanceKept;
                row.amountMicros = e.keptMicros ?? 0;
                break;
            }
            row.event = e.phase === "paid" ? t.allowancePaid : t.allowanceRefunded;
            row.amountMicros = e.amountMicros;
            row.tx = e.tx ?? null;
            break;
        case "mcp":
            row.event = e.tool;
            row.detail = parts([e.outcome, formatDuration(e.durationMs)]);
            if (e.outcome !== "ok") row.tone = "bad";
            break;
        case "job":
            if (e.phase === "start") {
                row.event = t.jobStarted(e.seq);
                break;
            }
            row.event = t.jobEnded(e.seq);
            row.detail = jobEndDetail(e.exitCode, e.oom === true, e.durationMs);
            if (e.oom === true || (e.exitCode !== undefined && e.exitCode !== 0)) row.tone = "bad";
            break;
        case "file":
            row.event = t.file(e.op);
            row.detail = parts([e.path, formatBytes(e.bytes)]);
            break;
        case "preview":
            if (e.phase === "traffic") {
                row.event = t.requests;
                row.detail = parts([
                    ctx.folded ? t.port(e.port) : null,
                    copy.metrics.requests(e.requests ?? 0),
                    formatBytes(e.bytes ?? 0),
                ]);
            } else {
                row.event = e.phase === "issued" ? t.previewIssued : t.previewRevoked;
                row.detail = [t.port(e.port)];
            }
            break;
        case "transfer":
            row.event = e.direction === "in" ? t.upload : t.download;
            row.detail = parts([e.name, formatBytes(e.bytes)]);
            break;
        case "ssh":
            row.event = e.phase === "start" ? t.sshStarted : t.sshEnded;
            if (e.phase === "end") row.detail = t.sshBytes(e.bytesIn ?? 0, e.bytesOut ?? 0);
            break;
        case "secret_host":
            row.event = t.requests;
            row.detail = parts([
                ctx.folded ? e.host : null,
                copy.metrics.requests(e.requests),
                formatBytes(e.bytes),
            ]);
            break;
        case "x402":
            x402Row(row, e, ctx);
            break;
    }
    return row;
}

function rowsOf(events: SessionEvent[], ctx: RowContext): EventRow[] {
    return events.map((e) => rowFor(e, ctx)).sort((a, b) => a.at.getTime() - b.at.getTime());
}

/* Nodes */

interface Group {
    id: string;
    kind: NodeKind;
    side: Side;
    fullLabel: string;
    events: SessionEvent[];
    count: number;
    metricParts: MetricPart[];
    paidMicros: number;
    settling: number;
    refused: number;
}

interface GroupOptions {
    kind: NodeKind;
    side: Side;
    fullLabel: string;
    events: SessionEvent[];
    count: number;
    metricParts?: MetricPart[];
    paidMicros?: number;
    // The kind, unless several nodes share it
    id?: string;
}

function group(o: GroupOptions): Group {
    return {
        id: o.id ?? o.kind,
        kind: o.kind,
        side: o.side,
        fullLabel: o.fullLabel,
        events: o.events,
        count: o.count,
        metricParts: o.metricParts ?? [],
        paidMicros: o.paidMicros ?? 0,
        settling: 0,
        refused: 0,
    };
}

const plain = (text: string): MetricPart => ({ text, amount: false, money: false });

function toNode(g: Group, ctx: RowContext): MapNode {
    return {
        id: g.id,
        kind: g.kind,
        side: g.side,
        label: truncateLabel(g.fullLabel),
        fullLabel: g.fullLabel,
        count: g.count,
        metricParts: g.metricParts,
        paidMicros: g.paidMicros,
        settling: g.settling,
        refused: g.refused,
        rows: rowsOf(g.events, ctx),
    };
}

function foldNode(
    groups: Group[],
    id: "more-right" | "more-bottom",
    fullLabel: string,
    metric: (count: number, paidMicros: number, settling: number) => MetricPart[],
    ctx: RowContext,
): MapNode {
    const count = groups.reduce((n, g) => n + g.count, 0);
    const paidMicros = groups.reduce((n, g) => n + g.paidMicros, 0);
    const settling = groups.reduce((n, g) => n + g.settling, 0);
    const metricParts = metric(count, paidMicros, settling);
    return {
        id,
        kind: id,
        side: id === "more-right" ? "right" : "bottom",
        label: fullLabel,
        fullLabel,
        count,
        metricParts,
        paidMicros,
        settling,
        refused: groups.reduce((n, g) => n + g.refused, 0),
        rows: rowsOf(
            groups.flatMap((g) => g.events),
            { ...ctx, folded: true },
        ),
    };
}

function hostParts(
    word: "calls" | "requests",
    count: number,
    paidMicros: number,
    settling: number,
): MetricPart[] {
    const list = [plain(copy.metrics[word](count))];
    if (paidMicros > 0) {
        list.push({ text: copy.metrics.usdc(paidMicros), amount: true, money: true });
    }
    if (settling > 0) list.push(plain(copy.metrics.settling(settling)));
    return list;
}

const usdcPart = (micros: number, text: string): MetricPart => ({
    text,
    amount: true,
    money: micros > 0,
});

function sandboxParts(placements: PlacementEvent[]): MetricPart[] {
    const placed = placements.find((e) => e.phase === "placed");
    let minutes = placed?.minutes;
    for (const e of placements) {
        if (e.phase === "extended" && e.minutes !== undefined) minutes = (minutes ?? 0) + e.minutes;
    }
    if (!placed) return minutes === undefined ? [] : [plain(copy.spec.minutes(minutes))];
    return specParts({ ...placed, diskGib: undefined }, minutes)
        .filter((p): p is string => p !== null)
        .map(plain);
}

function byCountThenName(a: Group, b: Group): number {
    if (a.count !== b.count) return b.count - a.count;
    if (a.fullLabel !== b.fullLabel) return a.fullLabel < b.fullLabel ? -1 : 1;
    return a.id < b.id ? -1 : 1;
}

interface Buckets {
    placements: PlacementEvent[];
    tools: SessionEvent[];
    toolCalls: number;
    payments: PaymentEvent[];
    allowances: AllowanceEvent[];
    hosts: Map<string, Group>;
    ports: Map<number, PreviewEvent[]>;
    ssh: SshEvent[];
    transfers: TransferEvent[];
}

function hostGroup(b: Buckets, kind: NodeKind, host: string, e: SessionEvent): Group {
    const id = `${kind}:${host}`;
    const g =
        b.hosts.get(id) ??
        group({ id, kind, side: "right", fullLabel: hostName(host), events: [], count: 0 });
    b.hosts.set(id, g);
    g.events.push(e);
    return g;
}

function sortEvents(events: SessionEvent[]): Buckets {
    const b: Buckets = {
        placements: [],
        tools: [],
        toolCalls: 0,
        payments: [],
        allowances: [],
        hosts: new Map(),
        ports: new Map(),
        ssh: [],
        transfers: [],
    };
    for (const e of events) {
        switch (e.kind) {
            case "placement":
                b.placements.push(e);
                break;
            case "mcp":
                b.toolCalls++;
                b.tools.push(e);
                break;
            case "job":
            case "file":
                b.tools.push(e);
                break;
            case "payment":
                b.payments.push(e);
                break;
            case "allowance":
                b.allowances.push(e);
                break;
            case "secret_host":
                hostGroup(b, "secret-host", e.host, e).count += e.requests;
                break;
            case "x402": {
                const kind = e.status === "refused_host" ? "refused-host" : "x402-host";
                const g = hostGroup(b, kind, e.host, e);
                g.count += e.count;
                if (isPaid(e)) g.paidMicros += e.amountMicros;
                if (isSettling(e)) g.settling += e.count;
                if (isRefused(e)) g.refused += e.count;
                break;
            }
            case "preview":
                b.ports.set(e.port, [...(b.ports.get(e.port) ?? []), e]);
                break;
            case "ssh":
                b.ssh.push(e);
                break;
            case "transfer":
                b.transfers.push(e);
                break;
        }
    }
    return b;
}

export function buildMap(record: SessionRecord): MapModel {
    const ctx: RowContext = {
        endedAt: record.endedAt,
        endedBecause: record.endedBecause,
        folded: false,
    };
    const b = sortEvents(record.events);
    const { metrics, nodes: names } = copy;

    const sandbox = group({
        kind: "sandbox",
        side: "center",
        fullLabel: names.sandbox,
        events: b.placements,
        count: b.placements.length,
        metricParts: sandboxParts(b.placements),
    });

    const paid = b.payments.reduce((n, e) => n + e.amountMicros, 0);
    const allowance = allowanceTotals(record.events);
    const paidIn = allowance?.paidInMicros ?? 0;
    const left = [
        group({
            kind: "mcp",
            side: "left",
            fullLabel: names.mcp,
            events: b.tools,
            count: b.toolCalls,
            metricParts: [plain(metrics.toolCalls(b.toolCalls))],
        }),
        group({
            kind: "payments",
            side: "left",
            fullLabel: names.payments,
            events: b.payments,
            count: b.payments.length,
            metricParts: [usdcPart(paid, metrics.paid(paid))],
            paidMicros: paid,
        }),
        group({
            kind: "allowance",
            side: "left",
            fullLabel: names.allowance,
            events: b.allowances,
            count: b.allowances.length,
            metricParts: [usdcPart(paidIn, metrics.usdc(paidIn)), plain(metrics.paidIn)],
            paidMicros: paidIn,
        }),
    ];

    const right = [...b.hosts.values()].sort(byCountThenName);
    const isCalls = (g: Group) => g.kind === "x402-host" || g.kind === "refused-host";
    for (const g of right) {
        g.metricParts = hostParts(
            isCalls(g) ? "calls" : "requests",
            g.count,
            g.paidMicros,
            g.settling,
        );
    }
    const rightNodes = right.slice(0, MAX_RIGHT).map((g) => toNode(g, ctx));
    const extraHosts = right.slice(MAX_RIGHT);
    if (extraHosts.length > 0) {
        // Every x402 call is one request, so a fold of both kinds of host counts requests
        const word = extraHosts.every(isCalls) ? "calls" : "requests";
        rightNodes.push(
            foldNode(
                extraHosts,
                "more-right",
                names.moreHosts(extraHosts.length),
                (count, paidMicros, settling) => hostParts(word, count, paidMicros, settling),
                ctx,
            ),
        );
    }

    const previews = [...b.ports.entries()]
        .sort(([x], [y]) => x - y)
        .map(([port, events]) => {
            const requests = events.reduce((n, e) => n + (e.requests ?? 0), 0);
            return group({
                id: `preview:${port}`,
                kind: "preview",
                side: "bottom",
                fullLabel: names.preview(port),
                events,
                count: requests,
                metricParts: [plain(metrics.requests(requests))],
            });
        });
    const bottomNodes = previews.slice(0, MAX_PREVIEWS).map((g) => toNode(g, ctx));
    const extraPorts = previews.slice(MAX_PREVIEWS);
    if (extraPorts.length > 0) {
        bottomNodes.push(
            foldNode(
                extraPorts,
                "more-bottom",
                names.morePorts(extraPorts.length),
                (count) => [plain(metrics.requests(count))],
                ctx,
            ),
        );
    }
    const sessions = b.ssh.filter((e) => e.phase === "start").length;
    const files = b.transfers.length;
    const tail = [
        group({
            kind: "ssh",
            side: "bottom",
            fullLabel: names.ssh,
            events: b.ssh,
            count: sessions,
            metricParts: [plain(metrics.sessions(sessions))],
        }),
        group({
            kind: "transfers",
            side: "bottom",
            fullLabel: names.transfers,
            events: b.transfers,
            count: files,
            metricParts: [plain(metrics.files(files))],
        }),
    ];

    // A node shows while it has rows, so a preview nobody opened still appears with 0 requests
    const nodes = [
        toNode(sandbox, ctx),
        ...left.map((g) => toNode(g, ctx)),
        ...rightNodes,
        ...bottomNodes,
        ...tail.map((g) => toNode(g, ctx)),
    ].filter((n) => n.kind === "sandbox" || n.rows.length > 0);

    return { nodes, empty: nodes.length === 1, eventsDropped: record.eventsDropped, allowance };
}

/* The allowance's totals (x402 spec 8.6) */

function byAmountThenHost(
    a: { host: string; micros: number },
    b: { host: string; micros: number },
): number {
    if (a.micros !== b.micros) return b.micros - a.micros;
    return a.host < b.host ? -1 : a.host > b.host ? 1 : 0;
}

// Only an ended record reaches the map, so the account is closed once it has a refund or kept row,
// or was spent in full; a figure still settling may yet move, so it never counts as off
function allowanceTotals(events: SessionEvent[]): AllowanceTotals | null {
    const rows = events.filter((e): e is AllowanceEvent => e.kind === "allowance");
    if (rows.length === 0) return null;
    const sum = (phase: AllowanceEvent["phase"], micros: (e: AllowanceEvent) => number) =>
        rows.filter((e) => e.phase === phase).reduce((n, e) => n + micros(e), 0);
    const paidIn = sum("paid", (e) => e.amountMicros);
    const refunds = rows.filter((e) => e.phase === "refunded");
    const refunded =
        refunds.length === 0
            ? null
            : { micros: sum("refunded", (e) => e.amountMicros), tx: refunds.at(-1)!.tx ?? null };
    const kept = rows.some((e) => e.phase === "kept")
        ? sum("kept", (e) => e.keptMicros ?? 0)
        : null;

    const spent = new Map<string, number>();
    const settling = { calls: 0, micros: 0 };
    const refusals = new Map<string, number>();
    for (const e of events) {
        if (e.kind !== "x402") continue;
        if (isPaid(e)) spent.set(e.host, (spent.get(e.host) ?? 0) + e.amountMicros);
        if (isSettling(e)) {
            settling.calls += e.count;
            settling.micros += e.amountMicros;
        }
        if (isRefused(e)) {
            const key = refusalKey(e);
            refusals.set(key, (refusals.get(key) ?? 0) + e.count);
        }
    }

    const spentList = [...spent]
        .map(([host, micros]) => ({ host, micros }))
        .filter((s) => s.micros > 0)
        .sort(byAmountThenHost);
    const spentTotal = spentList.reduce((n, s) => n + s.micros, 0);
    const refusedByReason = [...refusals]
        .map(([key, calls]) => ({ key, words: copy.x402.reason(key), calls }))
        .sort((a, b) => b.calls - a.calls || (a.key < b.key ? -1 : 1));
    const off = paidIn - spentTotal - (refunded?.micros ?? 0) - (kept ?? 0);
    const totals = {
        paidInMicros: paidIn,
        spent: spentList,
        settling,
        refunded,
        keptMicros: kept,
        refusedByReason,
    };
    return { ...totals, reconciling: settling.calls === 0 && accountClosed(totals) && off !== 0 };
}

function accountClosed(t: Omit<AllowanceTotals, "reconciling">): boolean {
    const spent = t.spent.reduce((n, s) => n + s.micros, 0);
    return t.refunded !== null || t.keptMicros !== null || spent === t.paidInMicros;
}
