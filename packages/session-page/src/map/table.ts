import { copy } from "../copy.ts";
import { formatClock, formatUsdc, shortSignature, usdcFraction } from "../format.ts";
import { isSignature } from "../payload.ts";
import { copyButton, type Clipboard } from "../render/controls.ts";
import { el, partSpans } from "../render/dom.ts";
import type { EventRow, MapNode } from "./model.ts";

const EXPLORER = "https://explorer.solana.com/tx/";

// Phones lay rows out as grids, which drops a table's own roles in WebKit
const CELL = { role: "cell" };
const ROW = { role: "row" };
const GROUP = { role: "rowgroup" };

interface TableOpts {
    now: Date;
    clipboard: Clipboard;
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
    if (tx === null) return el(doc, "td", { class: "ev-tx", attrs: CELL });
    if (!isSignature(tx)) {
        return el(doc, "td", { class: "ev-tx", text: shortSignature(tx), attrs: CELL });
    }
    const link = el(doc, "a", {
        class: "tx-link",
        text: shortSignature(tx),
        attrs: {
            href: `${EXPLORER}${tx}`,
            target: "_blank",
            rel: "noreferrer noopener",
            title: copy.openInExplorer,
        },
    });
    return el(doc, "td", { class: "ev-tx", attrs: CELL }, [
        link,
        copyButton(doc, copy.copySignature, () => tx, clipboard),
    ]);
}

function rowEl(doc: Document, row: EventRow, opts: TableOpts, shape: Shape): HTMLTableRowElement {
    const time = el(doc, "time", {
        text: formatClock(row.at, opts.now),
        attrs: { datetime: row.at.toISOString() },
    });
    const amount =
        row.amountMicros === null ? undefined : formatUsdc(row.amountMicros, shape.fraction);
    const cells: Record<Column, () => HTMLTableCellElement> = {
        time: () => el(doc, "td", { class: "ev-time num", attrs: CELL }, [time]),
        event: () => el(doc, "td", { class: "ev-event", text: row.event, attrs: CELL }),
        detail: () =>
            el(
                doc,
                "td",
                {
                    class: row.tone === "normal" ? "ev-detail" : `ev-detail ${row.tone}`,
                    attrs: CELL,
                },
                row.detail.length === 0
                    ? []
                    : [el(doc, "span", { class: "parts" }, partSpans(doc, row.detail))],
            ),
        amount: () =>
            el(doc, "td", {
                class: amount === undefined ? "ev-amount num" : "ev-amount num money",
                text: amount,
                attrs: CELL,
            }),
        tx: () => txCell(doc, row.tx, opts.clipboard),
    };
    return el(
        doc,
        "tr",
        { attrs: ROW },
        shown(shape).map((column) => cells[column]()),
    );
}

// A column no row fills is left out; Time and Event always have a value
function shapeOf(rows: readonly EventRow[]): Shape {
    const amounts = rows.flatMap((r) => (r.amountMicros === null ? [] : [r.amountMicros]));
    return {
        has: {
            time: true,
            event: true,
            detail: rows.some((r) => r.detail.length > 0),
            amount: amounts.length > 0,
            tx: rows.some((r) => r.tx !== null),
        },
        fraction: Math.max(0, ...amounts.map(usdcFraction)),
    };
}

export function renderEventTable(doc: Document, node: MapNode, opts: TableOpts): HTMLElement {
    const shape = shapeOf(node.rows);
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
    const table = el(doc, "table", { class: "events", attrs: { role: "table" } }, [
        el(doc, "caption", { text: node.fullLabel }),
        head,
        el(
            doc,
            "tbody",
            { attrs: GROUP },
            node.rows.map((row) => rowEl(doc, row, opts, shape)),
        ),
    ]);
    return el(doc, "div", { class: "table-scroll", attrs: { "data-node-id": node.id } }, [table]);
}
