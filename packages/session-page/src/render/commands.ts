import { copy, type ExitInfo } from "../copy.ts";
import { formatBytes, formatDuration } from "../format.ts";
import { OutputBuffer } from "../output.ts";
import type { Frame, Job, OutputState } from "../payload.ts";
import type { Scheduler } from "../schedule.ts";
import type { LiveFrame } from "../sse.ts";
import { copyButton, type Clipboard } from "./controls.ts";
import { el } from "./dom.ts";
import { createTerminalBlock, type Notice, type TerminalBlock } from "./terminal.ts";

export type LiveState = "idle" | "streaming" | "waiting" | "limit" | "done";

export interface CommandsView {
    root: HTMLElement;
    setJobs(jobs: Job[], now: Date): void;
    setOutput(state: OutputState | null): void;
    buffer(seq: number): OutputBuffer;
    apply(seq: number, frame: LiveFrame): void;
    setLive(seq: number, state: LiveState): void;
    // Most recently opened first
    openSeqs(): number[];
    // Called for the reader's own toggles, never for the row the first setJobs opens
    onToggle(cb: (seq: number, open: boolean) => void): void;
    destroy(): void;
}

export interface CommandsOpts {
    doc: Document;
    scheduler: Scheduler;
    clipboard: Clipboard;
    now: () => Date;
}

interface ExitFrame {
    exitCode: number | null;
    oom: boolean;
    peakMib: number;
    at: Date;
}

interface Row {
    seq: number;
    job: Job;
    // A live exit frame, used until a snapshot says the job finished
    exit: ExitFrame | null;
    filled: boolean;
    open: boolean;
    block: TerminalBlock | null;
    toggle: HTMLButtonElement;
    exitCell: HTMLTableCellElement;
    timeCell: HTMLTableCellElement;
    outCell: HTMLTableCellElement;
    errCell: HTMLTableCellElement;
    detail: HTMLTableRowElement;
    slot: HTMLTableCellElement;
}

const COLUMNS = 7;

let views = 0;

// The table cell holds one line; the open row shows the whole command
function oneLine(command: string | null): string {
    if (command === null) return copy.noCommand;
    const text = command.trimEnd();
    const end = text.search(/[\r\n]/);
    return end < 0 ? text : `${text.slice(0, end)}${copy.moreLines}`;
}

function bytes(n: number | null): string {
    return n === null ? copy.noValue : formatBytes(n);
}

function exitOf(row: Row): { info: ExitInfo; endedAt: Date | null } {
    const { job, exit } = row;
    if (job.state === "running" && exit !== null) {
        const { exitCode, oom, peakMib, at } = exit;
        return { info: { state: "exited", exitCode, oom, peakMib }, endedAt: at };
    }
    const { state, exitCode, oom, peakMib } = job;
    return { info: { state, exitCode, oom, peakMib }, endedAt: job.finishedAt };
}

function isRunning(row: Row): boolean {
    return exitOf(row).info.state === "running";
}

function durationMs(row: Row, now: Date): number | null {
    const { info, endedAt } = exitOf(row);
    const end = endedAt ?? (info.state === "running" ? now : null);
    return end === null ? null : end.getTime() - row.job.startedAt.getTime();
}

// OOM comes first, as in the exit line, since an OOM kill also leaves a non-zero code
function exitCellOf(info: ExitInfo): { text: string; tone: string; dot: boolean } {
    if (info.oom) return { text: copy.exitCell.oom, tone: "bad", dot: false };
    if (info.state === "running") return { text: copy.exitCell.running, tone: "", dot: true };
    if (info.state === "lost") return { text: copy.exitCell.lost, tone: "bad", dot: false };
    if (info.state === "cancelled") {
        return { text: copy.exitCell.cancelled, tone: "muted", dot: false };
    }
    if (info.exitCode === null) return { text: copy.noValue, tone: "", dot: false };
    return { text: String(info.exitCode), tone: info.exitCode === 0 ? "" : "bad", dot: false };
}

export function createCommandsView(opts: CommandsOpts): CommandsView {
    const { doc, scheduler } = opts;
    const view = ++views;
    const rows = new Map<number, Row>();
    const order: Row[] = [];
    const buffers = new Map<number, OutputBuffer>();
    const live = new Map<number, LiveState>();
    const opened: number[] = [];
    const listeners: ((seq: number, open: boolean) => void)[] = [];
    let output: OutputState | null = null;
    // Live text was shown, so an end that leaves the output saving keeps the rows on screen
    let streamed = false;
    let firstJobs = true;
    let ticking = false;
    let destroyed = false;

    // Both labels stay in the button and the CSS shows one, so its width never changes
    const expandLabel = el(doc, "span", { text: copy.expandAll });
    const collapseLabel = el(doc, "span", {
        text: copy.collapseAll,
        attrs: { "aria-hidden": "true" },
    });
    const expand = el(doc, "button", { class: "expand-all", attrs: { type: "button" } }, [
        expandLabel,
        collapseLabel,
    ]);
    const bar = el(doc, "div", { class: "commands-bar" }, [expand]);
    const note = el(doc, "p", { class: "commands-note", attrs: { "data-edge": "" } });
    const head = copy.commandsHead;
    const th = (text: string, cls?: string) =>
        el(doc, "th", { class: cls, text, attrs: { scope: "col" } });
    const tbody = el(doc, "tbody");
    const table = el(
        doc,
        "table",
        { class: "commands", attrs: { "data-edge": "", "aria-label": copy.commandsLabel } },
        [
            el(doc, "thead", {}, [
                el(doc, "tr", {}, [
                    th(head.seq, "num"),
                    th(head.command),
                    th(head.exit),
                    th(head.time, "num col-wide"),
                    th(head.out, "num col-wide"),
                    th(head.err, "num col-wide"),
                    // The copy column needs no heading, and an empty th reads as a missing one
                    el(doc, "td"),
                ]),
            ]),
            tbody,
        ],
    );
    const root = el(doc, "section", { class: "commands" }, [bar, note, table]);

    function bufferOf(seq: number): OutputBuffer {
        let buffer = buffers.get(seq);
        if (!buffer) {
            buffer = new OutputBuffer();
            buffers.set(seq, buffer);
        }
        return buffer;
    }

    function notices(row: Row): Notice[] {
        const list: Notice[] = [];
        if (row.job.cutBytes > 0) list.push({ text: copy.cut(row.job.cutBytes), tone: "warn" });
        const state = live.get(row.seq);
        // The page's own cap on streams is a wait, not a loss
        if (state === "waiting") list.push({ text: copy.waiting, tone: "muted" });
        else if (state === "limit") list.push({ text: copy.limit, tone: "warn" });
        return list;
    }

    // A snapshot carries no output, so a closed row's copy opens it, which streams the output
    function outputReady(seq: number): boolean {
        const row = rows.get(seq);
        if (row === undefined || row.filled || bufferOf(seq).text() !== "") return true;
        if ((row.job.outBytes ?? 0) + (row.job.errBytes ?? 0) === 0) return true;
        if (!row.open) {
            setOpen(row, true);
            syncExpand();
            notify([row], true);
        }
        return false;
    }

    function copyOutput(seq: number): HTMLButtonElement {
        const button = copyButton(
            doc,
            copy.copyOutput,
            () => bufferOf(seq).text(),
            opts.clipboard,
            scheduler,
            {
                name: copy.copyOutputOf(seq),
                prepare: () => outputReady(seq),
                isPartial: () => {
                    const buffer = bufferOf(seq);
                    const cut = rows.get(seq)?.job.cutBytes ?? 0;
                    return cut > 0 || buffer.droppedLines > 0 || buffer.skippedBytes > 0;
                },
            },
        );
        button.classList.add("copy-output");
        return button;
    }

    // Phones show no copy column, so the open row's command line carries its own copy button
    function mount(row: Row): void {
        row.block = createTerminalBlock({
            doc,
            buffer: bufferOf(row.seq),
            seq: row.seq,
            command: row.job.command,
            notices: () => notices(row),
            footer: () => copy.exitLine(exitOf(row).info, durationMs(row, opts.now()) ?? 0),
            control: copyOutput(row.seq),
            clipboard: opts.clipboard,
            scheduler,
        });
        row.slot.replaceChildren(row.block.root);
    }

    // Closed rows are not drawn; opening one draws everything its buffer holds
    function refresh(row: Row): void {
        if (row.open) row.block?.update();
    }

    function setOpen(row: Row, open: boolean): void {
        if (row.open === open) return;
        row.open = open;
        row.toggle.setAttribute("aria-expanded", String(open));
        row.detail.hidden = !open;
        const at = opened.indexOf(row.seq);
        if (at >= 0) opened.splice(at, 1);
        if (!open) return;
        opened.unshift(row.seq);
        if (row.block === null) mount(row);
        else row.block.update();
    }

    function notify(changed: Row[], open: boolean): void {
        for (const row of changed) for (const cb of listeners) cb(row.seq, open);
    }

    function syncExpand(): void {
        const all = order.length > 0 && order.every((r) => r.open);
        const [shown, hidden] = all ? [collapseLabel, expandLabel] : [expandLabel, collapseLabel];
        shown.removeAttribute("aria-hidden");
        hidden.setAttribute("aria-hidden", "true");
    }

    function syncOutput(): void {
        const message =
            output === "pending"
                ? copy.savingOutput
                : output === "expired"
                  ? copy.outputExpired
                  : output === "partial"
                    ? copy.outputPartial
                    : null;
        note.textContent = message ?? "";
        note.hidden = message === null;
        // Lost output warns; "Saving output…" is a wait and stays muted
        const lost = output === "partial" || output === "expired";
        note.className = lost ? "commands-note warn" : "commands-note";
        // Expired output still leaves each command, its exit and its time to show
        const shown = order.length > 0 && (output !== "pending" || streamed);
        table.hidden = !shown;
        bar.hidden = !shown;
        table.classList.toggle("no-output", output === "expired");
    }

    // True when the shown time changed
    function paintTime(row: Row, now: Date): boolean {
        const ms = durationMs(row, now);
        const text = ms === null ? copy.noValue : formatDuration(ms);
        if (row.timeCell.textContent === text) return false;
        row.timeCell.textContent = text;
        return true;
    }

    function paint(row: Row, now: Date): void {
        const { text, tone, dot } = exitCellOf(exitOf(row).info);
        const cell = row.exitCell;
        const cls = tone === "" ? "exit" : `exit ${tone}`;
        if (cell.className !== cls) cell.className = cls;
        // A new dot would restart its pulse on every snapshot
        if (cell.textContent !== text || (cell.querySelector("span.dot") !== null) !== dot) {
            const label = doc.createTextNode(text);
            if (dot) {
                const mark = el(doc, "span", { class: "dot", attrs: { "aria-hidden": "true" } });
                cell.replaceChildren(mark, label);
            } else {
                cell.replaceChildren(label);
            }
        }
        paintTime(row, now);
        row.outCell.textContent = bytes(row.job.outBytes);
        row.errCell.textContent = bytes(row.job.errBytes);
    }

    // Runs once per frame through the scheduler, so a hidden tab stops ticking
    function tick(): void {
        ticking = false;
        if (destroyed) return;
        const now = opts.now();
        for (const row of order) {
            // The open block's last line holds the same time, the only place phones show it
            if (isRunning(row) && paintTime(row, now)) refresh(row);
        }
        startTicking();
    }

    function startTicking(): void {
        if (ticking || destroyed || !order.some(isRunning)) return;
        ticking = true;
        scheduler.frame(tick);
    }

    // The record's frames are the whole saved output, so they replace any live text
    function fill(row: Row, frames: Frame[]): void {
        const buffer = new OutputBuffer();
        for (const frame of frames) buffer.apply(frame);
        buffers.set(row.seq, buffer);
        row.filled = true;
        if (row.block === null) return;
        row.block.destroy();
        row.block = null;
        if (row.open) mount(row);
    }

    function addRow(job: Job): Row {
        const id = `commands-${view}-${job.seq}`;
        const toggle = el(
            doc,
            "button",
            {
                class: "cmd-toggle",
                attrs: { type: "button", "aria-expanded": "false", "aria-controls": id },
            },
            // A command is code, which a page translation would rewrite
            [
                el(doc, "span", {
                    class: "cmd-text",
                    text: oneLine(job.command),
                    attrs: { translate: "no" },
                }),
            ],
        );
        const exitCell = el(doc, "td", { class: "exit" });
        const timeCell = el(doc, "td", { class: "num col-wide" });
        const outCell = el(doc, "td", { class: "num col-wide" });
        const errCell = el(doc, "td", { class: "num col-wide" });
        const copyCell = el(doc, "td", { class: "copy" }, [copyOutput(job.seq)]);
        const slot = el(doc, "td", { attrs: { colspan: String(COLUMNS) } });
        const detail = el(doc, "tr", { class: "cmd-detail", attrs: { id } }, [slot]);
        detail.hidden = true;
        const tr = el(doc, "tr", { class: "cmd-row", attrs: { "data-seq": String(job.seq) } }, [
            el(doc, "td", { class: "num", text: String(job.seq) }),
            el(doc, "td", { class: "cmd" }, [toggle]),
            exitCell,
            timeCell,
            outCell,
            errCell,
            copyCell,
        ]);
        const row: Row = {
            seq: job.seq,
            job,
            exit: null,
            filled: false,
            open: false,
            block: null,
            toggle,
            exitCell,
            timeCell,
            outCell,
            errCell,
            detail,
            slot,
        };
        toggle.addEventListener("click", () => {
            setOpen(row, !row.open);
            syncExpand();
            notify([row], row.open);
        });
        // The whole row lights up on hover, so a click anywhere on it opens it; the toggle stays
        // the one Tab stop, and a reader selecting text keeps the row as it was
        tr.addEventListener("click", (e) => {
            const target = e.target as Element;
            if (target.closest("button, a") !== null) return;
            if ((doc.getSelection()?.toString() ?? "") !== "") return;
            toggle.click();
        });
        tbody.append(tr, detail);
        rows.set(job.seq, row);
        order.push(row);
        return row;
    }

    expand.addEventListener("click", () => {
        const open = !order.every((r) => r.open);
        const changed = order.filter((r) => r.open !== open);
        for (const row of changed) setOpen(row, open);
        syncExpand();
        // After every row changed, so a listener reading openSeqs() sees the final set
        notify(changed, open);
    });

    syncOutput();

    return {
        root,

        setJobs(jobs, now) {
            for (const job of [...jobs].sort((a, b) => a.seq - b.seq)) {
                const row = rows.get(job.seq) ?? addRow(job);
                row.job = job;
                if (job.frames !== null && !row.filled) fill(row, job.frames);
                paint(row, now);
                refresh(row);
            }
            const last = order.at(-1);
            if (firstJobs && last !== undefined) {
                firstJobs = false;
                setOpen(last, true);
            }
            syncExpand();
            syncOutput();
            startTicking();
        },

        setOutput(state) {
            output = state;
            syncOutput();
        },

        buffer: bufferOf,

        apply(seq, frame) {
            const row = rows.get(seq);
            if (frame.type === "out" || frame.type === "skip") streamed = true;
            if (frame.type === "out") bufferOf(seq).apply(frame.frame);
            else if (frame.type === "skip") bufferOf(seq).skip(frame.outBytes, frame.errBytes);
            else if (frame.type === "exit" && row !== undefined) {
                const at = opts.now();
                const { exitCode, oom, peakMib } = frame;
                row.exit = { exitCode, oom, peakMib, at };
                paint(row, at);
            } else return;
            if (row !== undefined) refresh(row);
        },

        setLive(seq, state) {
            live.set(seq, state);
            const row = rows.get(seq);
            if (row !== undefined) refresh(row);
        },

        openSeqs: () => [...opened],

        onToggle(cb) {
            listeners.push(cb);
        },

        destroy() {
            destroyed = true;
            for (const row of order) row.block?.destroy();
            root.remove();
        },
    };
}
