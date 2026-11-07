import { copy } from "../copy.ts";
import { el } from "../render/dom.ts";
import type { MapModel, MapNode, MapSelect, MetricPart } from "./model.ts";

function rowLabel(node: MapNode): string {
    const refused = node.refused > 0 ? copy.metrics.refused(node.refused) : null;
    return [node.fullLabel, node.metric, refused].filter((p) => p !== null && p !== "").join(", ");
}

// The count and the total paid, so Payments leaves its refund to the table and the row's name
function shown(parts: MetricPart[]): MetricPart[] {
    const paid = parts.findIndex((p) => p.money);
    return paid === -1 ? parts : parts.slice(0, paid + 1);
}

function metricSpans(doc: Document, parts: MetricPart[]): HTMLSpanElement[] {
    return parts.flatMap((part, i) => {
        const span = el(doc, "span", { class: part.money ? "money" : "muted", text: part.text });
        return i > 0 ? [el(doc, "span", { class: "muted", text: copy.SEP }), span] : [span];
    });
}

function row(doc: Document, node: MapNode, opts: MapSelect): HTMLLIElement {
    const selected = node.id === opts.selectedId;
    const parts = [
        el(doc, "span", { class: "map-row-name", text: node.label }),
        el(doc, "span", { class: "map-row-metric" }, metricSpans(doc, shown(node.metricParts))),
    ];
    if (node.refused > 0) {
        parts.push(
            el(doc, "span", {
                class: "map-row-refused warn",
                text: copy.metrics.refused(node.refused),
            }),
        );
    }
    const button = el(
        doc,
        "button",
        {
            class: selected ? "map-row is-selected" : "map-row",
            attrs: {
                type: "button",
                "aria-pressed": String(selected),
                "aria-label": rowLabel(node),
                "data-node-id": node.id,
            },
        },
        parts,
    );
    button.addEventListener("click", () => opts.onSelect(node.id));
    return el(doc, "li", {}, [button]);
}

// The phone view of the map, with the same nodes and the same selection
export function renderMapList(doc: Document, model: MapModel, opts: MapSelect): HTMLUListElement {
    const list = el(
        doc,
        "ul",
        { class: "map-list", attrs: { "aria-label": copy.mapLabel } },
        model.nodes.map((node) => row(doc, node, opts)),
    );
    if (model.empty) list.append(el(doc, "li", { class: "map-empty muted", text: copy.noCalls }));
    return list;
}
