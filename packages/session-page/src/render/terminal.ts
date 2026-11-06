import { copy } from "../copy.js";
import type { Line, OutputBuffer } from "../output.js";
import type { Scheduler } from "../schedule.js";
import { el } from "./dom.js";

export interface TerminalBlock {
    root: HTMLElement;
    update(): void;
    destroy(): void;
}

const BOTTOM_SLACK_PX = 4;

function lineClass(line: Line): string {
    return line.s === "e" ? "line line-err" : "line";
}

export function createTerminalBlock(opts: {
    doc: Document;
    buffer: OutputBuffer;
    seq: number;
    command: string | null;
    notices: () => string[];
    footer: () => string | null;
    scheduler: Scheduler;
}): TerminalBlock {
    const { doc, buffer, scheduler } = opts;
    const cmd = el(doc, "p", {
        class: "term-cmd",
        text: `$ ${opts.command ?? copy.noCommand}`,
    });
    const notes = el(doc, "div", { class: "term-notes" });
    const out = el(doc, "div", {
        class: "term-out",
        attrs: { tabindex: "0", role: "log", "aria-label": `Output of command ${opts.seq}` },
    });
    const foot = el(doc, "p", { class: "term-foot" });
    const root = el(doc, "div", { class: "term" }, [cmd, notes, out, foot]);

    const nodes: HTMLElement[] = [];
    let droppedSeen = 0;
    let pending = false;
    let destroyed = false;

    const render = (): void => {
        pending = false;
        if (destroyed) return;
        const atBottom = out.scrollHeight - out.scrollTop - out.clientHeight <= BOTTOM_SLACK_PX;

        const drop = Math.min(buffer.droppedLines - droppedSeen, nodes.length);
        for (const node of nodes.splice(0, drop)) node.remove();
        droppedSeen = buffer.droppedLines;

        const lines = buffer.lines;
        // Only the last rendered line can still change: earlier ones are closed.
        const resume = Math.max(nodes.length - 1, 0);
        for (let i = resume; i < lines.length; i++) {
            const line = lines[i]!;
            const existing = nodes[i];
            if (existing === undefined) {
                const node = el(doc, "div", { class: lineClass(line), text: line.t });
                out.appendChild(node);
                nodes.push(node);
            } else {
                if (existing.textContent !== line.t) existing.textContent = line.t;
                const cls = lineClass(line);
                if (existing.className !== cls) existing.className = cls;
            }
        }

        const notices = [...opts.notices()];
        if (buffer.droppedLines > 0) notices.push(copy.dropped(buffer.droppedLines));
        if (buffer.skippedBytes > 0) notices.push(copy.skipped(buffer.skippedBytes));
        notes.replaceChildren(...notices.map((text) => el(doc, "p", { text })));
        notes.hidden = notices.length === 0;

        const footer = opts.footer();
        foot.textContent = footer ?? "";
        foot.hidden = footer === null;

        if (atBottom) out.scrollTop = out.scrollHeight;
    };

    const update = (): void => {
        if (pending || destroyed) return;
        pending = true;
        scheduler.frame(render);
    };

    update();

    return {
        root,
        update,
        destroy() {
            destroyed = true;
            root.remove();
        },
    };
}
