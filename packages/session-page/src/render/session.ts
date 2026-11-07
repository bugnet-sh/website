/**
 * The session's own parts of the page: the heading row with its status, the times with Delete
 * now, the message lines and the map with its caption and event table.
 *
 * Every block that starts a line carries data-edge, so a test can check they share one left edge.
 */
import { copy } from "../copy.ts";
import { layoutMap } from "../map/layout.ts";
import { renderMapList } from "../map/list.ts";
import { buildMap, type MapSelect } from "../map/model.ts";
import { renderMapSvg } from "../map/svg.ts";
import { renderEventTable } from "../map/table.ts";
import type { SessionRecord } from "../payload.ts";
import type { Clipboard } from "./controls.ts";
import { el } from "./dom.ts";

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
    const label = doc.createTextNode("");
    const state = el(doc, "p", { class: "session-state", attrs: { role: "status" } }, [dot, label]);
    state.hidden = true;
    const root = el(doc, "div", { class: "session-head", attrs: EDGE }, [
        el(doc, "div", { class: "session-heading" }, [heading]),
        state,
    ]);
    return {
        root,
        heading,
        setStatus(text, running = false) {
            if (label.data !== (text ?? "")) label.data = text ?? "";
            // Only a change of hidden touches the dot, so its pulse never restarts
            if (dot.hidden === running) dot.hidden = !running;
            state.hidden = text === null;
        },
    };
}

// Disabled at the first click, so a double click sends one request
function actionButton(
    doc: Document,
    cls: string,
    label: string,
    onClick: () => void,
): HTMLButtonElement {
    const button = el(doc, "button", {
        class: `button ${cls}`,
        text: label,
        attrs: { type: "button" },
    });
    button.addEventListener("click", () => {
        if (button.disabled) return;
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        onClick();
    });
    return button;
}

function plainButton(doc: Document, cls: string, label: string): HTMLButtonElement {
    return el(doc, "button", { class: `button ${cls}`, text: label, attrs: { type: "button" } });
}

export function retryButton(doc: Document, onRetry: () => void): HTMLButtonElement {
    return actionButton(doc, "retry", copy.retry, onRetry);
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

function deleteControl(doc: Document, onDelete: OnDelete): HTMLElement {
    const start = plainButton(doc, "delete-now", copy.deleteNow);
    const prompt = el(doc, "span", {
        class: "confirm-text",
        text: copy.confirmDelete,
        attrs: { tabindex: "-1", "aria-live": "polite" },
    });
    const yes = plainButton(doc, "confirm-delete", copy.confirm);
    const no = plainButton(doc, "cancel-delete", copy.cancel);
    const confirm = el(doc, "div", { class: "confirm" }, [prompt, yes, no]);
    confirm.hidden = true;

    const settle = (asking: boolean) => {
        yes.disabled = asking;
        no.disabled = asking;
    };
    start.addEventListener("click", () => {
        prompt.textContent = copy.confirmDelete;
        start.hidden = true;
        confirm.hidden = false;
        prompt.focus();
    });
    no.addEventListener("click", () => {
        confirm.hidden = true;
        start.hidden = false;
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
    return el(doc, "div", { class: "delete" }, [start, confirm]);
}

export function createSessionMeta(doc: Document, onDelete: OnDelete): SessionMeta {
    const times = el(doc, "p", { class: "session-times" });
    const root = el(doc, "div", { class: "session-meta", attrs: EDGE }, [
        times,
        deleteControl(doc, onDelete),
    ]);
    let shown: string | null = null;
    return {
        root,
        setTimes(parts) {
            const joined = parts.join(copy.SEP);
            if (joined === shown) return;
            shown = joined;
            // Each part stays on one line, so a narrow screen breaks only between parts
            times.replaceChildren(
                ...parts.flatMap((part, i) => {
                    const span = el(doc, "span", { class: "time-part", text: part });
                    return i === 0 ? [span] : [el(doc, "span", { text: copy.SEP }), span];
                }),
            );
        },
    };
}

export interface MapSection {
    root: HTMLElement;
    destroy(): void;
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
    const model = buildMap(record);
    // Empty, so its size changes with the width only and a redraw never re-triggers the observer
    const ruler = el(doc, "div", { class: "map-ruler", attrs: { "aria-hidden": "true" } });
    const map = el(doc, "div", { class: "map", attrs: EDGE }, [ruler]);
    const captions: string[] = [copy.notSeen];
    if (model.eventsDropped > 0) captions.push(copy.eventsDropped(model.eventsDropped));
    const caption = el(
        doc,
        "div",
        { class: "map-caption" },
        captions.map((text) => el(doc, "p", { text })),
    );
    const table = el(doc, "div", { class: "map-table" });
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
        const select: MapSelect = { selectedId, onSelect };
        if (drawSvg) {
            width = widthNow();
            const next = renderMapSvg(doc, layoutMap(model, width), select);
            if (svg === null) map.append(next);
            else svg.replaceWith(next);
            svg = next;
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

    // A second click, or Escape, sends the open node's id again and closes its table
    function onSelect(id: string): void {
        selectedId = selectedId === id ? null : id;
        redraw(true, true);
        const node = model.nodes.find((n) => n.id === selectedId);
        table.replaceChildren(
            ...(node === undefined
                ? []
                : [renderEventTable(doc, node, { now: opts.now(), clipboard: opts.clipboard })]),
        );
    }

    redraw(true, true);

    const Observer = doc.defaultView?.ResizeObserver;
    const observer =
        Observer === undefined
            ? null
            : new Observer(() => {
                  if (widthNow() !== width) redraw(true, false);
              });
    observer?.observe(ruler);

    return {
        root,
        destroy() {
            observer?.disconnect();
        },
    };
}
