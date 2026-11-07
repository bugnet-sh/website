import { copy } from "../copy.ts";
import { el } from "../render/dom.ts";
import {
    accessibleName,
    type MapModel,
    type MapNode,
    type MapSelect,
    type MetricPart,
} from "./model.ts";

// Names are hosts and ports, and metrics are numbers, which a translation would change
const KEEP = { translate: "no" };

function metricSpans(doc: Document, parts: MetricPart[]): HTMLSpanElement[] {
    return parts.map((part) =>
        el(doc, "span", { class: part.money ? "money" : "muted", text: part.text, attrs: KEEP }),
    );
}

// The whole metric, then the refusals, which wrap together when the row is narrow
function row(doc: Document, node: MapNode, opts: MapSelect): HTMLLIElement {
    const selected = node.id === opts.selectedId;
    const metric = metricSpans(doc, node.metricParts);
    if (node.refused > 0) {
        metric.push(
            el(doc, "span", {
                class: "map-row-refused warn",
                text: copy.metrics.refused(node.refused),
            }),
        );
    }
    const parts = [
        el(doc, "span", { class: "map-row-name", text: node.label, attrs: KEEP }),
        el(doc, "span", { class: "map-row-metric" }, metric),
    ];
    const button = el(
        doc,
        "button",
        {
            class: selected ? "map-row is-selected" : "map-row",
            attrs: {
                type: "button",
                "aria-expanded": String(selected),
                ...(opts.controls === undefined ? {} : { "aria-controls": opts.controls }),
                "aria-label": accessibleName(node),
                "data-node-id": node.id,
            },
        },
        parts,
    );
    button.addEventListener("click", () => opts.onSelect(node.id));
    button.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && opts.selectedId !== null) opts.onSelect(opts.selectedId);
    });
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
