import { copy } from "../copy.js";
import type { Line, OutputBuffer } from "../output.js";
import type { Scheduler } from "../schedule.js";
import { copyButton, type Clipboard } from "./controls.js";
import { el, partSpans } from "./dom.js";

// A wait reads muted, and a loss of output in the warning colour
export interface Notice {
    text: string;
    tone: "muted" | "warn";
}

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
    notices: () => Notice[];
    // The last line's parts, none while there is no last line
    footer: () => string[];
    // A control after the command's own copy button, such as the output's
    control?: HTMLElement;
    clipboard: Clipboard;
    scheduler: Scheduler;
}): TerminalBlock {
    const { doc, buffer, scheduler } = opts;
    const cmd = el(doc, "p", {
        class: "term-cmd",
        text: `$ ${opts.command ?? copy.noCommand}`,
    });
    const head = el(doc, "div", { class: "term-head" }, [cmd]);
    const { command } = opts;
    if (command !== null) {
        // Copies without the "$ " the line shows, so it pastes straight into a shell
        const copyCommand = copyButton(
            doc,
            copy.copyCommand,
            () => command,
            opts.clipboard,
            scheduler,
            { name: copy.copyCommandOf(opts.seq) },
        );
        copyCommand.classList.add("copy-command");
        head.append(copyCommand);
    }
    if (opts.control) head.append(opts.control);
    const notes = el(doc, "div", { class: "term-notes" });
    const out = el(doc, "div", {
        class: "term-out",
        attrs: { tabindex: "0", role: "log", "aria-label": copy.outputLabel(opts.seq) },
    });
    const foot = el(doc, "p", { class: "term-foot parts" });
    // The command and its output are code, which a page translation would rewrite
    const root = el(doc, "div", { class: "term", attrs: { translate: "no" } }, [
        head,
        notes,
        out,
        foot,
    ]);

    const nodes: HTMLElement[] = [];
    let droppedSeen = 0;
    let shownNotices: string | null = null;
    let shownFooter: string | null = null;
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
        // OutputBuffer only ever changes its tail line, so every node before the last is current
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
        if (buffer.droppedLines > 0) {
            notices.push({ text: copy.dropped(buffer.droppedLines), tone: "warn" });
        }
        if (buffer.skippedBytes > 0) {
            notices.push({ text: copy.skipped(buffer.skippedBytes), tone: "warn" });
        }
        const joined = notices.map((n) => `${n.tone} ${n.text}`).join("\n");
        if (joined !== shownNotices) {
            shownNotices = joined;
            notes.replaceChildren(
                ...notices.map(({ text, tone }) => el(doc, "p", { class: tone, text })),
            );
            notes.hidden = notices.length === 0;
        }

        const footer = opts.footer();
        const footerKey = footer.join("\n");
        if (footerKey !== shownFooter) {
            shownFooter = footerKey;
            foot.replaceChildren(...partSpans(doc, footer));
            foot.hidden = footer.length === 0;
        }

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
