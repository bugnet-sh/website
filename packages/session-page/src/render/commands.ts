import { copy, type ExitInfo } from "../copy.ts";
import { formatBytes, formatDuration } from "../format.ts";
import { OutputBuffer } from "../output.ts";
import type { Frame, Job, OutputState } from "../payload.ts";
import type { Scheduler } from "../schedule.ts";
import type { LiveFrame } from "../sse.ts";
import { copyButton, type Clipboard } from "./controls.ts";
import { el } from "./dom.ts";
import { createTerminalBlock, type TerminalBlock } from "./terminal.ts";

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
    let firstJobs = true;
    let ticking = false;
    let destroyed = false;

    const expand = el(doc, "button", {
        class: "expand-all",
        text: copy.expandAll,
        attrs: { type: "button" },
    });
    const bar = el(doc, "div", { class: "commands-bar" }, [expand]);
    const note = el(doc, "p", { class: "commands-note" });
    const head = copy.commandsHead;
    const th = (text: string, cls?: string) =>
        el(doc, "th", { class: cls, text, attrs: { scope: "col" } });
    const tbody = el(doc, "tbody");
    const table = el(doc, "table", { class: "commands" }, [
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
    ]);
    const root = el(doc, "section", { class: "commands" }, [bar, note, table]);

    function bufferOf(seq: number): OutputBuffer {
        let buffer = buffers.get(seq);
        if (!buffer) {
            buffer = new OutputBuffer();
            buffers.set(seq, buffer);
        }
        return buffer;
    }

    function notices(row: Row): string[] {
        const list: string[] = [];
        if (row.job.cutBytes > 0) list.push(copy.cut(row.job.cutBytes));
        const state = live.get(row.seq);
        if (state === "waiting") list.push(copy.waiting);
        else if (state === "limit") list.push(copy.limit);
        return list;
    }

    function mount(row: Row): void {
        row.block = createTerminalBlock({
            doc,
            buffer: bufferOf(row.seq),
            seq: row.seq,
            command: row.job.command,
            notices: () => notices(row),
            footer: () => copy.exitLine(exitOf(row).info, durationMs(row, opts.now()) ?? 0),
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
        expand.textContent = all ? copy.collapseAll : copy.expandAll;
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
        note.className = output === "partial" ? "commands-note warn" : "commands-note";
        const shown = output !== "pending" && output !== "expired" && order.length > 0;
        table.hidden = !shown;
        bar.hidden = !shown;
    }

    function paintTime(row: Row, now: Date): void {
        const ms = durationMs(row, now);
        const text = ms === null ? copy.noValue : formatDuration(ms);
        if (row.timeCell.textContent !== text) row.timeCell.textContent = text;
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
        for (const row of order) if (isRunning(row)) paintTime(row, now);
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
        const toggle = el(doc, "button", {
            class: "cmd-toggle",
            text: oneLine(job.command),
            attrs: { type: "button", "aria-expanded": "false", "aria-controls": id },
        });
        const exitCell = el(doc, "td", { class: "exit" });
        const timeCell = el(doc, "td", { class: "num col-wide" });
        const outCell = el(doc, "td", { class: "num col-wide" });
        const errCell = el(doc, "td", { class: "num col-wide" });
        const copyCell = el(doc, "td", { class: "copy" }, [
            copyButton(
                doc,
                copy.copyOutput,
                () => bufferOf(job.seq).text(),
                opts.clipboard,
                scheduler,
            ),
        ]);
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
