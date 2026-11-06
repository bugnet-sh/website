// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
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

function make(command: string | null = "ls") {
    const buffer = new OutputBuffer();
    const scheduler = manual();
    const block = createTerminalBlock({
        doc: document,
        buffer,
        seq: 3,
        command,
        notices: () => [],
        footer: () => null,
        scheduler,
    });
    scheduler.flush();
    return { buffer, scheduler, block };
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
        expect(block.root.querySelector(".term-notes")!.textContent).toContain(copy.dropped(1000));
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
        expect(out.getAttribute("aria-label")).toBe("Output of command 3");
    });

    it("shows notices and footer from the caller", () => {
        const buffer = new OutputBuffer();
        const scheduler = manual();
        const block = createTerminalBlock({
            doc: document,
            buffer,
            seq: 1,
            command: "x",
            notices: () => [copy.cut(2048)],
            footer: () => "exit 0",
            scheduler,
        });
        scheduler.flush();
        expect(block.root.querySelector(".term-notes")!.textContent).toBe(copy.cut(2048));
        expect(block.root.querySelector(".term-foot")!.textContent).toBe("exit 0");
    });
});
