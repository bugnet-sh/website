import { copy } from "../copy.ts";
import { formatClock, formatUsdc, shortSignature, usdcFraction } from "../format.ts";
import { isSignature } from "../payload.ts";
import { copyButton, tip, type Clipboard } from "../render/controls.ts";
import { el, partSpans } from "../render/dom.ts";
import type { AllowanceTotals, EventRow, MapNode } from "./model.ts";

const EXPLORER = "https://explorer.solana.com/tx/";

// Phones lay rows out as grids, which drops a table's own roles in WebKit
const CELL = { role: "cell" };
// Hosts, paths and signatures, which a page translation would rewrite
const DATA_CELL = { ...CELL, translate: "no" };
const ROW = { role: "row" };
const GROUP = { role: "rowgroup" };

interface TableOpts {
    now: Date;
    clipboard: Clipboard;
    // The Allowance's table closes with these
    allowance?: AllowanceTotals | null;
}

type Column = "time" | "event" | "detail" | "amount" | "tx";

// What every row of a table shares: the columns it shows and the fraction its amounts pad to
interface Shape {
    has: Record<Column, boolean>;
    fraction: number;
}

const COLUMNS: readonly Column[] = ["time", "event", "detail", "amount", "tx"];

const shown = (shape: Shape) => COLUMNS.filter((column) => shape.has[column]);

// Only a value that decodes to a signature becomes a link, so sandbox text never does
function txCell(doc: Document, tx: string | null, clipboard: Clipboard): HTMLTableCellElement {
    if (tx === null) return el(doc, "td", { class: "ev-tx", attrs: DATA_CELL });
    const short = shortSignature(tx);
    if (!isSignature(tx)) {
        return el(doc, "td", { class: "ev-tx", text: short, attrs: DATA_CELL });
    }
    const link = el(doc, "a", {
        class: "tx-link",
        text: short,
        attrs: {
            href: `${EXPLORER}${tx}`,
            target: "_blank",
            rel: "noreferrer noopener",
            title: copy.openInExplorer,
            // The visible text first, then where it goes
            "aria-label": `${short}, ${copy.openInExplorer}`,
        },
    });
    return el(doc, "td", { class: "ev-tx", attrs: DATA_CELL }, [
        link,
        copyButton(doc, copy.copySignature, () => tx, clipboard, undefined, {
            name: copy.copySignatureOf(short),
        }),
    ]);
}

function rowEl(doc: Document, row: EventRow, opts: TableOpts, shape: Shape): HTMLTableRowElement {
    const time = el(doc, "time", {
        text: formatClock(row.at, opts.now),
        attrs: { datetime: row.at.toISOString() },
    });
    const amount =
        row.amountMicros === null ? undefined : formatUsdc(row.amountMicros, shape.fraction);
    const amountClass =
        row.amountTone === null ? "ev-amount num" : `ev-amount num ${row.amountTone}`;
    const cells: Record<Column, () => HTMLTableCellElement> = {
        time: () => el(doc, "td", { class: "ev-time num", attrs: CELL }, [time]),
        event: () => el(doc, "td", { class: "ev-event", text: row.event, attrs: CELL }),
        detail: () =>
            el(
                doc,
                "td",
                {
                    class: row.tone === "normal" ? "ev-detail" : `ev-detail ${row.tone}`,
                    attrs: DATA_CELL,
                },
                row.detail.length === 0
                    ? []
                    : [el(doc, "span", { class: "parts" }, partSpans(doc, row.detail))],
            ),
        amount: () => el(doc, "td", { class: amountClass, text: amount, attrs: CELL }),
        tx: () => txCell(doc, row.tx, opts.clipboard),
    };
    return el(
        doc,
        "tr",
        { attrs: ROW },
        shown(shape).map((column) => cells[column]()),
    );
}

// A column no row fills is left out; Time and Event always have a value. The totals' values
// share the Amount column, so they pad to the same fraction.
function shapeOf(rows: readonly EventRow[], totals: readonly Total[]): Shape {
    const amounts = [...rows.map((r) => r.amountMicros), ...totals.map((t) => t.micros)].filter(
        (m): m is number => m !== null,
    );
    return {
        has: {
            time: true,
            event: true,
            detail: rows.some((r) => r.detail.length > 0),
            amount: amounts.length > 0,
            tx: [...rows, ...totals].some((r) => r.tx !== null),
        },
        fraction: Math.max(0, ...amounts.map(usdcFraction)),
    };
}

/* The Allowance's totals (x402 spec 8.6) */

interface Total {
    label: string;
    micros: number | null;
    tone: "money" | "muted" | null;
    tx: string | null;
}

// Only a non-zero sum is money, as on the map
const sum = (label: string, micros: number, tx: string | null = null): Total => ({
    label,
    micros,
    tone: micros > 0 ? "money" : "muted",
    tx,
});

function totalLines(t: AllowanceTotals): Total[] {
    const words = copy.totals;
    return [
        sum(words.paidIn, t.paidInMicros),
        ...t.spent.map((s) => sum(words.spent(s.host), s.micros)),
        // Settling money is only the seller's word until Payments resolves it
        ...(t.settling.calls > 0
            ? [
                  {
                      label: words.settling(t.settling.calls),
                      micros: t.settling.micros,
                      tone: "muted" as const,
                      tx: null,
                  },
              ]
            : []),
        ...(t.refunded === null ? [] : [sum(words.refunded, t.refunded.micros, t.refunded.tx)]),
        ...(t.keptMicros === null ? [] : [sum(words.kept, t.keptMicros)]),
        // The count is part of the label's words, so these rows have no value
        ...t.refusedByReason.map((r) => ({
            label: words.refused(r.words, r.calls),
            micros: null,
            tone: null,
            tx: null,
        })),
    ];
}

function totalRow(doc: Document, total: Total, opts: TableOpts, shape: Shape): HTMLTableRowElement {
    const value = total.micros === null ? undefined : formatUsdc(total.micros, shape.fraction);
    return el(doc, "tr", { class: "total", attrs: ROW }, [
        el(doc, "th", {
            class: "total-label",
            text: total.label,
            // The label runs under every column before the amounts, so its value lines up
            attrs: {
                scope: "row",
                role: "rowheader",
                colspan: String(shown(shape).indexOf("amount")),
            },
        }),
        el(doc, "td", {
            class: total.tone === null ? "ev-amount num" : `ev-amount num ${total.tone}`,
            text: value,
            attrs: CELL,
        }),
        ...(shape.has.tx ? [txCell(doc, total.tx, opts.clipboard)] : []),
    ]);
}

function totalsFoot(
    doc: Document,
    totals: AllowanceTotals,
    lines: Total[],
    opts: TableOpts,
    shape: Shape,
): HTMLTableSectionElement {
    if (totals.reconciling) {
        const note = el(doc, "td", {
            class: "totals-note",
            text: copy.reconciling,
            attrs: { ...CELL, colspan: String(shown(shape).length) },
        });
        return el(doc, "tfoot", { attrs: GROUP }, [el(doc, "tr", { attrs: ROW }, [note])]);
    }
    return el(
        doc,
        "tfoot",
        { attrs: GROUP },
        lines.map((line) => totalRow(doc, line, opts, shape)),
    );
}

function captionOf(doc: Document, node: MapNode, totals: boolean): HTMLTableCaptionElement {
    if (!totals) return el(doc, "caption", { text: node.fullLabel });
    return el(doc, "caption", { class: "has-tip" }, [
        el(doc, "span", { text: node.fullLabel }),
        tip(doc, copy.allowanceTip, copy.allowanceTipLabel),
    ]);
}

export function renderEventTable(doc: Document, node: MapNode, opts: TableOpts): HTMLElement {
    const totals = node.kind === "allowance" ? (opts.allowance ?? null) : null;
    // The figures being reconciled replace every total, so none of them shapes the columns
    const lines = totals === null || totals.reconciling ? [] : totalLines(totals);
    const shape = shapeOf(node.rows, lines);
    const head = el(doc, "thead", { attrs: GROUP }, [
        el(
            doc,
            "tr",
            { attrs: ROW },
            shown(shape).map((column) =>
                el(doc, "th", {
                    // Amounts sit at the end of their cells, so their heading does too
                    class: column === "amount" ? "ev-amount num" : `ev-${column}`,
                    text: copy.eventsHead[column],
                    attrs: { scope: "col", role: "columnheader" },
                }),
            ),
        ),
    ]);
    const table = el(
        doc,
        "table",
        {
            class: "events",
            // The tip's button would otherwise join the caption in the table's name
            attrs:
                totals === null
                    ? { role: "table" }
                    : { role: "table", "aria-label": node.fullLabel },
        },
        [
            captionOf(doc, node, totals !== null),
            head,
            el(
                doc,
                "tbody",
                { attrs: GROUP },
                node.rows.map((row) => rowEl(doc, row, opts, shape)),
            ),
            ...(totals === null ? [] : [totalsFoot(doc, totals, lines, opts, shape)]),
        ],
    );
    // A few rows and their totals never need the scroller, which would clip the open tip
    return el(
        doc,
        "div",
        {
            class: totals === null ? "table-scroll" : "table-scroll is-whole",
            attrs: { "data-node-id": node.id },
        },
        [table],
    );
}
