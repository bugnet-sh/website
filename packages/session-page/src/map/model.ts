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
    detail: string;
    amountMicros: number | null;
    tx: string | null;
    tone: Tone;
}

export interface MapNode {
    id: string;
    kind: NodeKind;
    side: Side;
    label: string;
    fullLabel: string;
    count: number;
    metric: string;
    paidMicros: number;
    refused: number;
    rows: EventRow[];
}

export interface MapModel {
    nodes: MapNode[];
    empty: boolean;
    eventsDropped: number;
}

export const MAX_RIGHT = 6;
export const MAX_PREVIEWS = 4;

// The separator the page text puts between parts, where a long metric may break
export const SEPARATOR = " · ";

function join(parts: (string | null)[]): string {
    return parts.filter((p): p is string => p !== null && p !== "").join(SEPARATOR);
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

function placementText(e: PlacementEvent, ctx: RowContext): [string, string] {
    const t = copy.rows;
    switch (e.phase) {
        case "placed":
            return [t.placed, join(specParts(e, e.minutes))];
        case "ready":
            return [t.ready, ""];
        case "extended": {
            const by = e.minutes === undefined ? null : t.extendedBy(e.minutes);
            const until = e.deadline ? t.until(formatClock(e.deadline, ctx.endedAt)) : null;
            return [t.extended, [by, until].filter((p) => p !== null).join(", ")];
        }
        case "ended":
            return [t.ended, copy.endedReason[e.endedBecause ?? ctx.endedBecause]];
    }
}

function jobEndDetail(exitCode: number | undefined, oom: boolean, durationMs?: number): string {
    const took = durationMs === undefined ? null : formatDuration(durationMs);
    if (oom) return join([copy.rows.oom, took]);
    return join([exitCode === undefined ? null : copy.rows.exit(exitCode), took]);
}

function rowFor(e: SessionEvent, ctx: RowContext): EventRow {
    const t = copy.rows;
    const row: EventRow = {
        at: e.at,
        event: "",
        detail: "",
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
            row.detail = join([e.outcome, formatDuration(e.durationMs)]);
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
            row.detail = join([e.path, formatBytes(e.bytes)]);
            break;
        case "preview":
            if (e.phase === "traffic") {
                row.event = t.requests;
                row.detail = join([
                    ctx.folded ? t.port(e.port) : null,
                    copy.metrics.requests(e.requests ?? 0),
                    formatBytes(e.bytes ?? 0),
                ]);
            } else {
                row.event = e.phase === "issued" ? t.previewIssued : t.previewRevoked;
                row.detail = t.port(e.port);
            }
            break;
        case "transfer":
            row.event = e.direction === "in" ? t.upload : t.download;
            row.detail = join([e.name, formatBytes(e.bytes)]);
            break;
        case "ssh":
            row.event = e.phase === "start" ? t.sshStarted : t.sshEnded;
            if (e.phase === "end") row.detail = t.sshBytes(e.bytesIn ?? 0, e.bytesOut ?? 0);
            break;
        case "secret_host":
            row.event = t.requests;
            row.detail = join([
                ctx.folded ? e.host : null,
                copy.metrics.requests(e.requests),
                formatBytes(e.bytes),
            ]);
            break;
        case "x402": {
            const status = statusText(e.status);
            row.event = `${e.method} ${e.path}`;
            row.detail = join([ctx.folded ? e.host : null, status.text]);
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
    metric: string;
    paidMicros: number;
    refused: number;
}

function toNode(g: Group, ctx: RowContext): MapNode {
    return {
        id: g.id,
        kind: g.kind,
        side: g.side,
        label: truncateLabel(g.fullLabel),
        fullLabel: g.fullLabel,
        count: g.count,
        metric: g.metric,
        paidMicros: g.paidMicros,
        refused: g.refused,
        rows: rowsOf(g.events, ctx),
    };
}

function foldNode(
    groups: Group[],
    id: "more-right" | "more-bottom",
    fullLabel: string,
    metric: (count: number, paidMicros: number) => string,
    ctx: RowContext,
): MapNode {
    const count = groups.reduce((n, g) => n + g.count, 0);
    const paidMicros = groups.reduce((n, g) => n + g.paidMicros, 0);
    return {
        id,
        kind: id,
        side: id === "more-right" ? "right" : "bottom",
        label: fullLabel,
        fullLabel,
        count,
        metric: metric(count, paidMicros),
        paidMicros,
        refused: groups.reduce((n, g) => n + g.refused, 0),
        rows: rowsOf(
            groups.flatMap((g) => g.events),
            { ...ctx, folded: true },
        ),
    };
}

function hostMetric(kind: NodeKind, count: number, paidMicros: number): string {
    if (kind === "secret-host") return copy.metrics.requests(count);
    return join([copy.metrics.calls(count), paidMicros > 0 ? copy.metrics.usdc(paidMicros) : null]);
}

function sandboxMetric(placements: PlacementEvent[]): string {
    const placed = placements.find((e) => e.phase === "placed");
    let minutes = placed?.minutes;
    for (const e of placements) {
        if (e.phase === "extended" && e.minutes !== undefined) minutes = (minutes ?? 0) + e.minutes;
    }
    if (!placed) return minutes === undefined ? "" : copy.spec.minutes(minutes);
    return join(specParts({ ...placed, diskGib: undefined }, minutes));
}

function byCountThenName(a: Group, b: Group): number {
    if (a.count !== b.count) return b.count - a.count;
    if (a.fullLabel !== b.fullLabel) return a.fullLabel < b.fullLabel ? -1 : 1;
    return a.id < b.id ? -1 : 1;
}

export function buildMap(record: SessionRecord): MapModel {
    const ctx: RowContext = {
        endedAt: record.endedAt,
        endedBecause: record.endedBecause,
        folded: false,
    };
    const placements: PlacementEvent[] = [];
    const tools: SessionEvent[] = [];
    let toolCalls = 0;
    const money: (PaymentEvent | AllowanceEvent)[] = [];
    const hosts = new Map<string, Group>();
    const ports = new Map<number, PreviewEvent[]>();
    const ssh: SshEvent[] = [];
    const transfers: TransferEvent[] = [];

    for (const e of record.events) {
        switch (e.kind) {
            case "placement":
                placements.push(e);
                break;
            case "mcp":
                toolCalls++;
                tools.push(e);
                break;
            case "job":
            case "file":
                tools.push(e);
                break;
            case "payment":
            case "allowance":
                money.push(e);
                break;
            case "secret_host":
            case "x402": {
                const kind = e.kind === "x402" ? "x402-host" : "secret-host";
                const id = `${kind}:${e.host}`;
                let g = hosts.get(id);
                if (!g) {
                    g = {
                        id,
                        kind,
                        side: "right",
                        fullLabel: e.host,
                        events: [],
                        count: 0,
                        metric: "",
                        paidMicros: 0,
                        refused: 0,
                    };
                    hosts.set(id, g);
                }
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
                ports.set(e.port, [...(ports.get(e.port) ?? []), e]);
                break;
            case "ssh":
                ssh.push(e);
                break;
            case "transfer":
                transfers.push(e);
                break;
        }
    }

    const sandbox = toNode(
        {
            id: "sandbox",
            kind: "sandbox",
            side: "center",
            fullLabel: copy.nodes.sandbox,
            events: placements,
            count: placements.length,
            metric: sandboxMetric(placements),
            paidMicros: 0,
            refused: 0,
        },
        ctx,
    );

    let paid = 0;
    let refunded = 0;
    for (const e of money) {
        if (e.kind === "allowance" && e.phase === "refunded") refunded += e.amountMicros;
        else paid += e.amountMicros;
    }
    const left: Group[] = [
        {
            id: "mcp",
            kind: "mcp",
            side: "left",
            fullLabel: copy.nodes.mcp,
            events: tools,
            count: toolCalls,
            metric: copy.metrics.toolCalls(toolCalls),
            paidMicros: 0,
            refused: 0,
        },
        {
            id: "payments",
            kind: "payments",
            side: "left",
            fullLabel: copy.nodes.payments,
            events: money,
            count: money.length,
            metric: copy.metrics.paid(paid, refunded),
            paidMicros: paid,
            refused: 0,
        },
    ];

    const right = [...hosts.values()].sort(byCountThenName);
    for (const g of right) g.metric = hostMetric(g.kind, g.count, g.paidMicros);
    const rightNodes = right.slice(0, MAX_RIGHT).map((g) => toNode(g, ctx));
    const extraHosts = right.slice(MAX_RIGHT);
    if (extraHosts.length > 0) {
        const anyX402 = extraHosts.some((g) => g.kind === "x402-host");
        rightNodes.push(
            foldNode(
                extraHosts,
                "more-right",
                copy.nodes.moreHosts(extraHosts.length),
                (count, paidMicros) =>
                    hostMetric(anyX402 ? "x402-host" : "secret-host", count, paidMicros),
                ctx,
            ),
        );
    }

    const previews = [...ports.entries()]
        .sort(([a], [b]) => a - b)
        .map(([port, events]): Group => {
            const requests = events.reduce((n, e) => n + (e.requests ?? 0), 0);
            return {
                id: `preview:${port}`,
                kind: "preview",
                side: "bottom",
                fullLabel: copy.nodes.preview(port),
                events,
                count: requests,
                metric: copy.metrics.requests(requests),
                paidMicros: 0,
                refused: 0,
            };
        });
    const bottomNodes = previews.slice(0, MAX_PREVIEWS).map((g) => toNode(g, ctx));
    const extraPorts = previews.slice(MAX_PREVIEWS);
    if (extraPorts.length > 0) {
        bottomNodes.push(
            foldNode(
                extraPorts,
                "more-bottom",
                copy.nodes.morePorts(extraPorts.length),
                (count) => copy.metrics.requests(count),
                ctx,
            ),
        );
    }
    const sessions = ssh.filter((e) => e.phase === "start").length;
    const tail: Group[] = [
        {
            id: "ssh",
            kind: "ssh",
            side: "bottom",
            fullLabel: copy.nodes.ssh,
            events: ssh,
            count: sessions,
            metric: copy.metrics.sessions(sessions),
            paidMicros: 0,
            refused: 0,
        },
        {
            id: "transfers",
            kind: "transfers",
            side: "bottom",
            fullLabel: copy.nodes.transfers,
            events: transfers,
            count: transfers.length,
            metric: copy.metrics.files(transfers.length),
            paidMicros: 0,
            refused: 0,
        },
    ];

    // A node shows while it has rows, so a preview nobody opened still appears with 0 requests
    const nodes = [
        sandbox,
        ...left.map((g) => toNode(g, ctx)),
        ...rightNodes,
        ...bottomNodes,
        ...tail.map((g) => toNode(g, ctx)),
    ].filter((n) => n.kind === "sandbox" || n.rows.length > 0);

    return { nodes, empty: nodes.length === 1, eventsDropped: record.eventsDropped };
}
