import { copy } from "../copy.ts";
import { formatClock, formatUsdc, shortSignature } from "../format.ts";
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

// Only a value that decodes to a signature becomes a link, so sandbox text never does
function txCell(doc: Document, tx: string | null, clipboard: Clipboard): HTMLTableCellElement {
    if (tx === null) return el(doc, "td", { class: "tx", attrs: CELL });
    if (!isSignature(tx)) {
        return el(doc, "td", { class: "tx", text: shortSignature(tx), attrs: CELL });
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
    return el(doc, "td", { class: "tx", attrs: CELL }, [
        link,
        copyButton(doc, copy.copySignature, () => tx, clipboard),
    ]);
}

function rowEl(doc: Document, row: EventRow, opts: TableOpts): HTMLTableRowElement {
    const time = el(doc, "time", {
        text: formatClock(row.at, opts.now),
        attrs: { datetime: row.at.toISOString() },
    });
    const amount = row.amountMicros === null ? undefined : formatUsdc(row.amountMicros);
    return el(doc, "tr", { attrs: ROW }, [
        el(doc, "td", { class: "num", attrs: CELL }, [time]),
        el(doc, "td", { text: row.event, attrs: CELL }),
        el(
            doc,
            "td",
            { class: row.tone === "normal" ? "" : row.tone, attrs: CELL },
            row.detail.length === 0
                ? []
                : [el(doc, "span", { class: "parts" }, partSpans(doc, row.detail))],
        ),
        el(doc, "td", {
            class: amount === undefined ? "num" : "num money",
            text: amount,
            attrs: CELL,
        }),
        txCell(doc, row.tx, opts.clipboard),
    ]);
}

export function renderEventTable(doc: Document, node: MapNode, opts: TableOpts): HTMLElement {
    const head = el(doc, "thead", { attrs: GROUP }, [
        el(
            doc,
            "tr",
            { attrs: ROW },
            Object.values(copy.eventsHead).map((text) =>
                el(doc, "th", { text, attrs: { scope: "col", role: "columnheader" } }),
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
            node.rows.map((row) => rowEl(doc, row, opts)),
        ),
    ]);
    return el(doc, "div", { class: "table-scroll", attrs: { "data-node-id": node.id } }, [table]);
}
