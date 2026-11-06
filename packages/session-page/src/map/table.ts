import { copy } from "../copy.ts";
import { formatClock, formatUsdc, shortSignature } from "../format.ts";
import { isSignature } from "../payload.ts";
import { copyButton, type Clipboard } from "../render/controls.ts";
import { el } from "../render/dom.ts";
import type { EventRow, MapNode } from "./model.ts";

const EXPLORER = "https://explorer.solana.com/tx/";

interface TableOpts {
    now: Date;
    clipboard: Clipboard;
}

// Only a value that decodes to a signature becomes a link, so sandbox text never does
function txCell(doc: Document, tx: string | null, clipboard: Clipboard): HTMLTableCellElement {
    if (tx === null) return el(doc, "td", { class: "tx" });
    if (!isSignature(tx)) return el(doc, "td", { class: "tx", text: shortSignature(tx) });
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
    return el(doc, "td", { class: "tx" }, [
        link,
        copyButton(doc, copy.copySignature, () => tx, clipboard),
    ]);
}

function rowEl(doc: Document, row: EventRow, opts: TableOpts): HTMLTableRowElement {
    const time = el(doc, "time", {
        text: formatClock(row.at, opts.now),
        attrs: { datetime: row.at.toISOString() },
    });
    return el(doc, "tr", {}, [
        el(doc, "td", { class: "num" }, [time]),
        el(doc, "td", { text: row.event }),
        el(doc, "td", { class: row.tone === "normal" ? "" : row.tone, text: row.detail }),
        row.amountMicros === null
            ? el(doc, "td", { class: "num" })
            : el(doc, "td", { class: "num money", text: formatUsdc(row.amountMicros) }),
        txCell(doc, row.tx, opts.clipboard),
    ]);
}

export function renderEventTable(doc: Document, node: MapNode, opts: TableOpts): HTMLElement {
    const head = el(doc, "thead", {}, [
        el(
            doc,
            "tr",
            {},
            Object.values(copy.eventsHead).map((text) =>
                el(doc, "th", { text, attrs: { scope: "col" } }),
            ),
        ),
    ]);
    const table = el(doc, "table", { class: "events" }, [
        el(doc, "caption", { text: node.fullLabel }),
        head,
        el(
            doc,
            "tbody",
            {},
            node.rows.map((row) => rowEl(doc, row, opts)),
        ),
    ]);
    return el(doc, "div", { class: "table-scroll", attrs: { "data-node-id": node.id } }, [table]);
}
