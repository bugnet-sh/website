/**
 * The session's own parts of the page: the heading row with its status, the times with Delete
 * now, the message lines and the map with its caption and event table.
 *
 * Every block that can start a line carries data-edge, so a test can check they share one left
 * edge.
 */
import { copy } from "../copy.ts";
import { layoutMap } from "../map/layout.ts";
import { renderMapList } from "../map/list.ts";
import { buildMap, type MapNode, type MapSelect } from "../map/model.ts";
import { fitLabels, renderMapSvg } from "../map/svg.ts";
import { renderEventTable } from "../map/table.ts";
import type { SessionRecord } from "../payload.ts";
import type { Clipboard } from "./controls.ts";
import { el, partSpans } from "./dom.ts";

const EDGE = { "data-edge": "" };

// The map is drawn for 720 px and up, and below 768 px the list shows in its place
const MIN_MAP_WIDTH = 720;

export interface SessionHead {
    root: HTMLElement;
    heading: HTMLHeadingElement;
    setStatus(text: string | null, running?: boolean): void;
}

export function createSessionHead(doc: Document): SessionHead {
    const heading = el(doc, "h1", {
        class: "session-title",
        text: copy.heading,
        attrs: { tabindex: "-1" },
    });
    const dot = el(doc, "span", { class: "dot", attrs: { "aria-hidden": "true" } });
    dot.hidden = true;
    // An element, not a text node: a page translation swaps text nodes out, and writing to a
    // detached one would leave the old status on screen
    const label = el(doc, "span", { class: "state-label" });
    const state = el(doc, "p", { class: "session-state", attrs: { ...EDGE, role: "status" } }, [
        dot,
        label,
    ]);
    state.hidden = true;
    const root = el(doc, "div", { class: "session-head", attrs: EDGE }, [
        el(doc, "div", { class: "session-heading" }, [heading]),
        state,
    ]);
    // What the page last set, since a translation changes what the label holds
    let said = "";
    return {
        root,
        heading,
        setStatus(text, running = false) {
            if (said !== (text ?? "")) {
                said = text ?? "";
                label.textContent = said;
            }
            // Only a change of hidden touches the dot, so its pulse never restarts
            if (dot.hidden === running) dot.hidden = !running;
            state.hidden = text === null;
        },
    };
}

// Disabled at the first click, so a double click sends one request. Both labels stay in the
// button and the CSS shows one, so its width never changes as it turns busy.
function actionButton(
    doc: Document,
    cls: string,
    label: string,
    busyLabel: string,
    onClick: () => void,
): HTMLButtonElement {
    const idle = el(doc, "span", { text: label });
    const busy = el(doc, "span", { text: busyLabel, attrs: { "aria-hidden": "true" } });
    const button = el(doc, "button", { class: `button ${cls}`, attrs: { type: "button" } }, [
        idle,
        busy,
    ]);
    button.addEventListener("click", () => {
        if (button.disabled) return;
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        idle.setAttribute("aria-hidden", "true");
        busy.removeAttribute("aria-hidden");
        onClick();
    });
    return button;
}

function plainButton(doc: Document, cls: string, label: string): HTMLButtonElement {
    return el(doc, "button", { class: `button ${cls}`, text: label, attrs: { type: "button" } });
}

export function retryButton(doc: Document, onRetry: () => void): HTMLButtonElement {
    return actionButton(doc, "retry", copy.retry, copy.loading, onRetry);
}

// Focusable, so the page can move focus to the line that replaced the view
export function messageLine(doc: Document, text: string): HTMLParagraphElement {
    return el(doc, "p", { class: "message", text, attrs: { ...EDGE, tabindex: "-1" } });
}

export function mapLaterLine(doc: Document): HTMLParagraphElement {
    return el(doc, "p", { class: "map-later", text: copy.mapLater, attrs: EDGE });
}

export interface SessionMeta {
    root: HTMLElement;
    setTimes(parts: string[]): void;
}

// Resolves true once the page has moved on, false when the delete failed and may be tried again
export type OnDelete = () => Promise<boolean>;

export function createSessionMeta(doc: Document, onDelete: OnDelete): SessionMeta {
    const times = el(doc, "p", { class: "session-times parts" });
    // Asked in the times' place, with its buttons in Delete now's, so nothing below moves
    const prompt = el(doc, "p", {
        class: "confirm-text",
        text: copy.confirmDelete,
        attrs: { tabindex: "-1", "aria-live": "polite" },
    });
    const start = plainButton(doc, "delete-now danger", copy.deleteNow);
    const yes = plainButton(doc, "confirm-delete danger", copy.confirm);
    const no = plainButton(doc, "cancel-delete", copy.cancel);
    const confirm = el(doc, "div", { class: "confirm" }, [yes, no]);
    const asking = (on: boolean) => {
        times.hidden = on;
        start.hidden = on;
        prompt.hidden = !on;
        confirm.hidden = !on;
    };
    asking(false);

    const settle = (busy: boolean) => {
        yes.disabled = busy;
        no.disabled = busy;
    };
    start.addEventListener("click", () => {
        prompt.textContent = copy.confirmDelete;
        asking(true);
        prompt.focus();
    });
    no.addEventListener("click", () => {
        asking(false);
        start.focus();
    });
    yes.addEventListener("click", () => {
        if (yes.disabled) return;
        settle(true);
        prompt.textContent = copy.deleting;
        const failed = () => {
            prompt.textContent = copy.deleteFailed;
            settle(false);
            yes.focus();
        };
        onDelete().then((done) => {
            if (!done) failed();
        }, failed);
    });

    const root = el(doc, "div", { class: "session-meta", attrs: EDGE }, [
        times,
        prompt,
        el(doc, "div", { class: "delete" }, [start, confirm]),
    ]);
    let shown: string | null = null;
    return {
        root,
        setTimes(parts) {
            const joined = parts.join("\n");
            if (joined === shown) return;
            shown = joined;
            // Each part stays on one line, so a narrow screen breaks only between parts
            times.replaceChildren(...partSpans(doc, parts, "time-part"));
        },
    };
}

function captionLines(doc: Document, eventsDropped: number): HTMLParagraphElement[] {
    const captions: string[] = [copy.notSeen];
    if (eventsDropped > 0) captions.push(copy.eventsDropped(eventsDropped));
    return captions.map((text) => el(doc, "p", { text }));
}

// What shows when the map fails to draw: its caption alone
export function emptyMapSection(doc: Document, record: SessionRecord): HTMLElement {
    const caption = el(
        doc,
        "div",
        { class: "map-caption" },
        captionLines(doc, record.eventsDropped),
    );
    return el(doc, "div", { class: "map-section" }, [caption]);
}

export interface MapSection {
    root: HTMLElement;
    // Redraws from a later record, keeping the open bubble while it is still drawn
    update(record: SessionRecord): void;
    destroy(): void;
}

// Events can still land after the end, and an unchanged record keeps the reader's place
const recordKey = (record: SessionRecord) => JSON.stringify([record.events, record.eventsDropped]);

const rowsKey = (node: MapNode | undefined) =>
    node === undefined ? "" : JSON.stringify(node.rows);

const FOCUSABLE = "a[href], button, [tabindex]";

let sections = 0;

// Where focus sits in a table: its row's text, and its place among that row's controls
interface TablePlace {
    row: string | null;
    index: number;
}

function placeOf(table: Element, active: Element): TablePlace {
    const tr = active.closest("tr");
    const scope = tr ?? table;
    return {
        row: tr?.textContent ?? null,
        index: [...scope.querySelectorAll(FOCUSABLE)].indexOf(active),
    };
}

// The same row by its text, else the same place in the whole table
function findPlace(table: Element, place: TablePlace): HTMLElement | null {
    const tr = [...table.querySelectorAll("tr")].find((r) => r.textContent === place.row);
    const scope = tr ?? table;
    const all = [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)];
    return all[Math.min(place.index, all.length - 1)] ?? null;
}

function nodeElement(host: Element, selector: string, id: string): HTMLElement | SVGElement | null {
    for (const node of host.querySelectorAll<HTMLElement | SVGElement>(selector)) {
        if (node.getAttribute("data-node-id") === id) return node;
    }
    return null;
}

export function createMapSection(
    doc: Document,
    record: SessionRecord,
    opts: { now: () => Date; clipboard: Clipboard },
): MapSection {
    let model = buildMap(record);
    let shownKey = recordKey(record);
    // Empty, so its size changes with the width only and a redraw never re-triggers the observer
    const ruler = el(doc, "div", { class: "map-ruler", attrs: { "aria-hidden": "true" } });
    const map = el(doc, "div", { class: "map", attrs: EDGE }, [ruler]);
    const caption = el(doc, "div", { class: "map-caption" });
    const tableId = `map-table-${++sections}`;
    const table = el(doc, "div", { class: "map-table", attrs: { id: tableId } });
    const root = el(doc, "div", { class: "map-section" }, [map, caption, table]);

    let selectedId: string | null = null;
    let width = 0;
    let svg: SVGSVGElement | null = null;
    let list: HTMLUListElement | null = null;

    const widthNow = () => Math.max(MIN_MAP_WIDTH, Math.floor(ruler.clientWidth));

    // Both views are redrawn whole, so the focused bubble or row is found again by its id
    function redraw(drawSvg: boolean, drawList: boolean): void {
        const active = doc.activeElement;
        const focused =
            active !== null && map.contains(active)
                ? (active.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null)
                : null;
        const inSvg = active !== null && svg !== null && svg.contains(active);
        const select: MapSelect = { selectedId, onSelect, controls: tableId };
        if (drawSvg) {
            width = widthNow();
            const next = renderMapSvg(doc, layoutMap(model, width), select);
            if (svg === null) map.append(next);
            else svg.replaceWith(next);
            svg = next;
            // A detached text measures nothing, so the first draw fits again once the fonts are
            // ready and the observer first fires, both after the section is on the page
            fitLabels(next);
        }
        if (drawList) {
            const next = renderMapList(doc, model, select);
            if (list === null) map.append(next);
            else list.replaceWith(next);
            list = next;
        }
        if (focused === null) return;
        const target = inSvg
            ? nodeElement(svg!, "g.map-node", focused)
            : nodeElement(list!, "button.map-row", focused);
        target?.focus();
    }

    function showCaption(): void {
        caption.replaceChildren(...captionLines(doc, model.eventsDropped));
    }

    const selected = () => model.nodes.find((n) => n.id === selectedId);

    function showTable(): void {
        const node = selected();
        table.replaceChildren(
            ...(node === undefined
                ? []
                : [renderEventTable(doc, node, { now: opts.now(), clipboard: opts.clipboard })]),
        );
    }

    // A second click, or Escape, sends the open node's id again and closes its table
    function onSelect(id: string): void {
        selectedId = selectedId === id ? null : id;
        redraw(true, true);
        showTable();
    }

    // Escape inside the open table closes it and goes back to its bubble, or to its row on a phone
    table.addEventListener("keydown", (e) => {
        if (e.key !== "Escape" || selectedId === null) return;
        const id = selectedId;
        onSelect(id);
        const svgShown = svg !== null && doc.defaultView?.getComputedStyle(svg).display !== "none";
        const back = svgShown
            ? nodeElement(svg!, "g.map-node", id)
            : nodeElement(list!, "button.map-row", id);
        back?.focus();
    });

    showCaption();
    redraw(true, true);

    // The faces may load after the first draw, and they change what each name measures
    void doc.fonts?.ready.then(() => {
        if (svg !== null) fitLabels(svg);
    });

    const Observer = doc.defaultView?.ResizeObserver;
    const observer =
        Observer === undefined
            ? null
            : new Observer(() => {
                  if (widthNow() !== width) redraw(true, false);
                  // A map hidden on a phone measures nothing, so it fits again once it shows
                  else if (svg !== null) fitLabels(svg);
              });
    observer?.observe(ruler);

    return {
        root,
        update(next) {
            const key = recordKey(next);
            if (key === shownKey) return;
            shownKey = key;
            const shownRows = rowsKey(selected());
            const active = doc.activeElement;
            const place = active !== null && table.contains(active) ? placeOf(table, active) : null;
            model = buildMap(next);
            if (!model.nodes.some((n) => n.id === selectedId)) selectedId = null;
            showCaption();
            redraw(true, true);
            // An open table whose rows did not change keeps the reader's scroll and focus
            if (selectedId !== null && rowsKey(selected()) === shownRows) return;
            showTable();
            if (place !== null) findPlace(table, place)?.focus();
        },
        destroy() {
            observer?.disconnect();
        },
    };
}
