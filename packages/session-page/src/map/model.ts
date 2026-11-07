/**
 * Turns a session record into the bubble map's nodes (session-page-ui.md 5).
 *
 * The sandbox sits in the centre. Bugnet's own services go left (MCP, then Payments), the hosts
 * that egress sees go right, busiest first, and the ways in go along the bottom (previews by port,
 * then SSH, then transfers). Past MAX_RIGHT hosts or MAX_PREVIEWS ports, the rest fold into one
 * "+N more" node, whose rows name their host or port. Each node carries its table rows, already
 * written as page text and sorted by time.
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
    | "secret-host"
    | "x402-host"
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
    refused: number;
    rows: EventRow[];
}

export interface MapModel {
    nodes: MapNode[];
    empty: boolean;
    eventsDropped: number;
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

const REFUSED: readonly string[] = ["refused_cap", "refused_price", "refused_host"];

function isRefused(e: X402Event): boolean {
    return REFUSED.includes(e.status);
}

// An own-property check, so a status such as "toString" is shown as its word
function statusText(status: string): { text: string; tone: Tone } {
    const known = copy.rows.x402;
    if (!Object.hasOwn(known, status)) return { text: status, tone: "normal" };
    const text = known[status as keyof typeof known];
    if (status === "upstream_error") return { text, tone: "bad" };
    return { text, tone: REFUSED.includes(status) ? "warn" : "normal" };
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
            row.tx = e.tx;
            break;
        case "allowance":
            row.event = e.phase === "paid" ? t.allowancePaid : t.allowanceRefunded;
            row.amountMicros = e.amountMicros;
            row.tx = e.tx;
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
        case "x402": {
            const status = statusText(e.status);
            row.event = `${e.method} ${e.path}`;
            row.detail = parts([ctx.folded ? e.host : null, status.text]);
            row.tone = status.tone;
            row.amountMicros = e.amountMicros > 0 ? e.amountMicros : null;
            row.tx = e.tx ?? null;
            break;
        }
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
        refused: g.refused,
        rows: rowsOf(g.events, ctx),
    };
}

function foldNode(
    groups: Group[],
    id: "more-right" | "more-bottom",
    fullLabel: string,
    metric: (count: number, paidMicros: number) => MetricPart[],
    ctx: RowContext,
): MapNode {
    const count = groups.reduce((n, g) => n + g.count, 0);
    const paidMicros = groups.reduce((n, g) => n + g.paidMicros, 0);
    const metricParts = metric(count, paidMicros);
    return {
        id,
        kind: id,
        side: id === "more-right" ? "right" : "bottom",
        label: fullLabel,
        fullLabel,
        count,
        metricParts,
        paidMicros,
        refused: groups.reduce((n, g) => n + g.refused, 0),
        rows: rowsOf(
            groups.flatMap((g) => g.events),
            { ...ctx, folded: true },
        ),
    };
}

function hostParts(word: "calls" | "requests", count: number, paidMicros: number): MetricPart[] {
    const counted = plain(copy.metrics[word](count));
    if (paidMicros <= 0) return [counted];
    return [counted, { text: copy.metrics.usdc(paidMicros), amount: true, money: true }];
}

function paymentParts(paidMicros: number, refundedMicros: number): MetricPart[] {
    const paid = { text: copy.metrics.paid(paidMicros), amount: true, money: paidMicros > 0 };
    if (refundedMicros <= 0) return [paid];
    return [paid, { text: copy.metrics.refunded(refundedMicros), amount: true, money: true }];
}

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
    money: (PaymentEvent | AllowanceEvent)[];
    hosts: Map<string, Group>;
    ports: Map<number, PreviewEvent[]>;
    ssh: SshEvent[];
    transfers: TransferEvent[];
}

function sortEvents(events: SessionEvent[]): Buckets {
    const b: Buckets = {
        placements: [],
        tools: [],
        toolCalls: 0,
        money: [],
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
            case "allowance":
                b.money.push(e);
                break;
            case "secret_host":
            case "x402": {
                const kind = e.kind === "x402" ? "x402-host" : "secret-host";
                const id = `${kind}:${e.host}`;
                const g =
                    b.hosts.get(id) ??
                    group({ id, kind, side: "right", fullLabel: e.host, events: [], count: 0 });
                b.hosts.set(id, g);
                g.events.push(e);
                if (e.kind === "secret_host") {
                    g.count += e.requests;
                } else {
                    g.count++;
                    g.paidMicros += e.amountMicros;
                    if (isRefused(e)) g.refused++;
                }
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

    let paid = 0;
    let refunded = 0;
    for (const e of b.money) {
        if (e.kind === "allowance" && e.phase === "refunded") refunded += e.amountMicros;
        else paid += e.amountMicros;
    }
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
            events: b.money,
            count: b.money.length,
            metricParts: paymentParts(paid, refunded),
            paidMicros: paid,
        }),
    ];

    const right = [...b.hosts.values()].sort(byCountThenName);
    for (const g of right) {
        const word = g.kind === "x402-host" ? "calls" : "requests";
        g.metricParts = hostParts(word, g.count, g.paidMicros);
    }
    const rightNodes = right.slice(0, MAX_RIGHT).map((g) => toNode(g, ctx));
    const extraHosts = right.slice(MAX_RIGHT);
    if (extraHosts.length > 0) {
        // Every x402 call is one request, so a fold of both kinds of host counts requests
        const word = extraHosts.every((g) => g.kind === "x402-host") ? "calls" : "requests";
        rightNodes.push(
            foldNode(
                extraHosts,
                "more-right",
                names.moreHosts(extraHosts.length),
                (count, paidMicros) => hostParts(word, count, paidMicros),
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

    return { nodes, empty: nodes.length === 1, eventsDropped: record.eventsDropped };
}
