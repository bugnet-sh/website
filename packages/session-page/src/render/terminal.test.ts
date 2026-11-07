// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { copy } from "../copy.js";
import { OutputBuffer } from "../output.js";
import type { Scheduler } from "../schedule.js";
import { createTerminalBlock } from "./terminal.js";

function manual(): Scheduler & { flush(): number; queued(): number } {
    let queue: (() => void)[] = [];
    return {
        frame: (cb) => void queue.push(cb),
        queued: () => queue.length,
        flush() {
            const batch = queue;
            queue = [];
            batch.forEach((cb) => cb());
            return batch.length;
        },
    };
}

const board = () => ({ writeText: vi.fn(async (_text: string) => {}) });

function make(command: string | null = "ls") {
    const buffer = new OutputBuffer();
    const scheduler = manual();
    const clipboard = board();
    const block = createTerminalBlock({
        doc: document,
        buffer,
        seq: 3,
        command,
        notices: () => [],
        footer: () => [],
        clipboard,
        scheduler,
    });
    scheduler.flush();
    return { buffer, scheduler, block, clipboard };
}

const lines = (root: HTMLElement) => [...root.querySelectorAll(".line")] as HTMLElement[];

describe("terminal block", () => {
    it("never turns output into elements", () => {
        const { buffer, scheduler, block } = make();
        buffer.apply({ s: "o", t: "<img src=x onerror=alert(1)>\n", cr: false });
        block.update();
        scheduler.flush();
        expect(block.root.querySelector("img")).toBeNull();
        expect(lines(block.root)[0]!.textContent).toBe("<img src=x onerror=alert(1)>");
    });

    it("marks stderr lines", () => {
        const { buffer, scheduler, block } = make();
        buffer.apply({ s: "e", t: "bad\n", cr: false });
        block.update();
        scheduler.flush();
        expect(lines(block.root)[0]!.classList.contains("line-err")).toBe(true);
    });

    it("reuses the last node on a carriage return", () => {
        const { buffer, scheduler, block } = make();
        buffer.apply({ s: "o", t: "50%", cr: false });
        block.update();
        scheduler.flush();
        const before = lines(block.root).at(-1)!;
        buffer.apply({ s: "o", t: "60%", cr: true });
        block.update();
        scheduler.flush();
        const after = lines(block.root).at(-1)!;
        expect(after).toBe(before);
        expect(after.textContent).toBe("60%");
    });

    it("renders once per frame however often update is called", () => {
        const { scheduler, block } = make();
        for (let i = 0; i < 100; i++) block.update();
        expect(scheduler.queued()).toBe(1);
    });

    it("drops front nodes and reports it", () => {
        const { buffer, scheduler, block } = make();
        for (let i = 0; i < 6000; i++) buffer.apply({ s: "o", t: `l${i}\n`, cr: false });
        block.update();
        scheduler.flush();
        expect(lines(block.root)).toHaveLength(5000);
        expect(lines(block.root)[0]!.textContent).toBe("l1000");
        const note = block.root.querySelector(".term-notes p")!;
        expect(note.textContent).toBe(copy.dropped(1000));
        expect(note.className).toBe("warn");
    });

    it("tones each notice, a wait muted and a loss in the warning colour", () => {
        const buffer = new OutputBuffer();
        const scheduler = manual();
        let notices = [
            { text: copy.cut(2048), tone: "warn" as const },
            { text: copy.waiting, tone: "muted" as const },
        ];
        const block = createTerminalBlock({
            doc: document,
            buffer,
            seq: 1,
            command: "x",
            notices: () => notices,
            footer: () => [],
            clipboard: board(),
            scheduler,
        });
        buffer.skip(2048, 0);
        block.update();
        scheduler.flush();
        const shown = () =>
            [...block.root.querySelectorAll(".term-notes p")].map((p) => [
                p.textContent,
                p.className,
            ]);
        expect(shown()).toEqual([
            [copy.cut(2048), "warn"],
            [copy.waiting, "muted"],
            [copy.skipped(2048), "warn"],
        ]);
        notices = [{ text: copy.waiting, tone: "warn" as const }];
        block.update();
        scheduler.flush();
        expect(shown()[0]).toEqual([copy.waiting, "warn"]);
    });

    it("copies the command without its $ prompt", async () => {
        const { block, clipboard } = make("npm test -- --grep x");
        const head = block.root.querySelector(".term-head")!;
        const button = head.querySelector<HTMLButtonElement>("button.copy-command")!;
        expect(button.textContent).toContain(copy.copyCommand);
        button.click();
        await Promise.resolve();
        expect(clipboard.writeText).toHaveBeenCalledExactlyOnceWith("npm test -- --grep x");
    });

    it("offers no command copy when the command was not recorded", () => {
        const { block } = make(null);
        expect(block.root.querySelector(".copy-command")).toBeNull();
    });

    it("removes dropped nodes from the front and keeps the ones that survive", () => {
        const { buffer, scheduler, block } = make();
        for (let i = 0; i < 5000; i++) buffer.apply({ s: "o", t: `l${i}\n`, cr: false });
        block.update();
        scheduler.flush();
        const survivor = lines(block.root)[4999]!;
        expect(survivor.textContent).toBe("l4999");
        for (let i = 5000; i < 6000; i++) buffer.apply({ s: "o", t: `l${i}\n`, cr: false });
        block.update();
        scheduler.flush();
        const after = lines(block.root);
        expect(after).toHaveLength(5000);
        expect(after[0]!.textContent).toBe("l1000");
        expect(after[3999]).toBe(survivor);
        expect(after.at(-1)!.textContent).toBe("l5999");
    });

    it("labels the log and shows a missing command", () => {
        const { block } = make(null);
        expect(block.root.querySelector(".term-cmd")!.textContent).toBe("$ (command not recorded)");
        const out = block.root.querySelector(".term-out")!;
        expect(out.getAttribute("role")).toBe("log");
        expect(out.getAttribute("tabindex")).toBe("0");
        expect(out.getAttribute("aria-label")).toBe(copy.outputLabel(3));
    });

    it("shows notices and the footer's parts from the caller", () => {
        const buffer = new OutputBuffer();
        const scheduler = manual();
        const block = createTerminalBlock({
            doc: document,
            buffer,
            seq: 1,
            command: "x",
            notices: () => [{ text: copy.cut(2048), tone: "warn" }],
            footer: () => ["exit 0", "9.2 s"],
            clipboard: board(),
            scheduler,
        });
        scheduler.flush();
        expect(block.root.querySelector(".term-notes")!.textContent).toBe(copy.cut(2048));
        const foot = block.root.querySelector<HTMLElement>(".term-foot")!;
        expect([...foot.children].map((p) => p.textContent)).toEqual(["exit 0", "9.2 s"]);
        expect(foot.classList.contains("parts")).toBe(true);
        expect(foot.hidden).toBe(false);
    });

    it("hides the footer while it has no parts", () => {
        const { block } = make();
        expect(block.root.querySelector<HTMLElement>(".term-foot")!.hidden).toBe(true);
    });

    it("keeps the notice nodes while the notices stay the same", () => {
        const buffer = new OutputBuffer();
        const scheduler = manual();
        const block = createTerminalBlock({
            doc: document,
            buffer,
            seq: 1,
            command: "x",
            notices: () => [{ text: copy.cut(2048), tone: "warn" }],
            footer: () => [],
            clipboard: board(),
            scheduler,
        });
        scheduler.flush();
        const note = block.root.querySelector(".term-notes p");
        buffer.apply({ s: "o", t: "more\n", cr: false });
        block.update();
        scheduler.flush();
        expect(block.root.querySelector(".term-notes p")).toBe(note);
        expect(note!.textContent).toBe(copy.cut(2048));
    });
});
