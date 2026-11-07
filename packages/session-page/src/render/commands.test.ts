// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { copy } from "../copy.ts";
import { parseGetBody, type Job } from "../payload.ts";
import type { Scheduler } from "../schedule.ts";
import { makeScenarios, type ScenarioName } from "../testing/fixtures.ts";
import { createCommandsView } from "./commands.ts";

const NOW = new Date("2026-11-06T12:00:00Z");
const scenarios = makeScenarios(NOW);

function manual(): Scheduler & { flush(): void; queued(): number } {
    let queue: (() => void)[] = [];
    return {
        frame: (cb) => void queue.push(cb),
        queued: () => queue.length,
        flush() {
            const batch = queue;
            queue = [];
            batch.forEach((cb) => cb());
        },
    };
}

function ended(name: ScenarioName) {
    const body = parseGetBody(scenarios[name].gets[0]!.body);
    if (body.state !== "ended") throw new Error(`expected ended, got ${body.state}`);
    return body.record;
}

function runningJobs(): Job[] {
    const body = parseGetBody(scenarios.running.gets[0]!.body);
    if (body.state !== "running") throw new Error(`expected running, got ${body.state}`);
    return body.snapshot.jobs;
}

function make() {
    const scheduler = manual();
    const clipboard = { writeText: vi.fn(async (_text: string) => {}) };
    let now = NOW;
    const view = createCommandsView({ doc: document, scheduler, clipboard, now: () => now });
    document.body.replaceChildren(view.root);
    const setNow = (d: Date) => {
        now = d;
    };
    return { view, scheduler, clipboard, setNow };
}

function showEnded(name: ScenarioName) {
    const t = make();
    const record = ended(name);
    t.view.setOutput(record.output);
    t.view.setJobs(record.jobs, NOW);
    t.scheduler.flush();
    return { ...t, record };
}

const rows = (root: HTMLElement) => [...root.querySelectorAll<HTMLTableRowElement>("tr.cmd-row")];
const row = (root: HTMLElement, seq: number) =>
    root.querySelector<HTMLTableRowElement>(`tr.cmd-row[data-seq="${seq}"]`)!;
const toggle = (root: HTMLElement, seq: number) =>
    row(root, seq).querySelector<HTMLButtonElement>("button.cmd-toggle")!;
const detail = (root: HTMLElement, seq: number) =>
    root.querySelector<HTMLTableRowElement>(`#${toggle(root, seq).getAttribute("aria-controls")}`)!;
const exitCell = (root: HTMLElement, seq: number) => row(root, seq).querySelector("td.exit")!;
const cellTexts = (root: HTMLElement, seq: number) =>
    [...row(root, seq).cells].map((c) => c.textContent);
const lineTexts = (root: HTMLElement, seq: number) =>
    [...detail(root, seq).querySelectorAll(".line")].map((l) => l.textContent);
const notes = (root: HTMLElement, seq: number) =>
    detail(root, seq).querySelector(".term-notes")!.textContent;
const expandAll = (root: HTMLElement) =>
    root.querySelector<HTMLButtonElement>("button.expand-all")!;
// Both labels stay in the button, so it keeps its width, and only one is read or seen
const shownLabel = (button: HTMLElement) =>
    [...button.children]
        .filter((c) => c.getAttribute("aria-hidden") !== "true")
        .map((c) => c.textContent);
// Values hold no-break spaces, which these expectations write as plain ones
const plain = (s: string | null) => (s ?? "").replaceAll("\u00a0", " ");
const footer = (root: HTMLElement, seq: number) =>
    [...detail(root, seq).querySelectorAll(".term-foot > span")].map((s) => plain(s.textContent));

describe("createCommandsView", () => {
    it("shows ended-full as six rows, the last one open with its command, output and exit", () => {
        const { view } = showEnded("ended-full");
        expect(rows(view.root).map((r) => r.dataset.seq)).toEqual(["1", "2", "3", "4", "5", "6"]);
        for (const seq of [1, 2, 3, 4, 5]) {
            expect(toggle(view.root, seq).getAttribute("aria-expanded")).toBe("false");
            expect(detail(view.root, seq).hidden).toBe(true);
        }
        expect(toggle(view.root, 6).getAttribute("aria-expanded")).toBe("true");
        const open = detail(view.root, 6);
        expect(open.hidden).toBe(false);
        expect(open.querySelector(".term-cmd")!.textContent).toBe(
            "$ pip install torch==2.5.1 --progress-bar on",
        );
        expect(lineTexts(view.root, 6)).toEqual([
            "Collecting torch==2.5.1",
            "  Downloading torch-2.5.1-cp312-none-macosx_11_0_arm64.whl (63.6 MB)",
            "100% ━━━━━━━━━━━━━━━━━━━━ 63.6/63.6 MB",
            "Installing collected packages: torch",
            "Successfully installed torch-2.5.1",
        ]);
        expect(footer(view.root, 6)).toEqual(["exit 0", "2 min 10 s", "peak 512 MiB"]);
        expect(view.openSeqs()).toEqual([6]);
    });

    it("fills the cells of each column, with a dash for unknown byte counts", () => {
        const { view } = showEnded("ended-full");
        const head = [...view.root.querySelectorAll("thead th")].map((th) => th.textContent);
        expect(head).toEqual(Object.values(copy.commandsHead));
        expect(cellTexts(view.root, 2).map(plain)).toEqual([
            "2",
            "npm test -- --grep zz-sample-ended-full",
            "1",
            "9.2 s",
            "148 B",
            "126 B",
            [copy.copyOutput, copy.copied, copy.copiedPartial, copy.copyFailed, copy.loading].join(
                "",
            ),
        ]);
        // The provider lost job 5, so no end event gave its byte counts
        expect(cellTexts(view.root, 5).slice(4, 6)).toEqual([copy.noValue, copy.noValue]);
        for (const r of rows(view.root)) {
            const wide = [...r.cells].filter((c) => c.classList.contains("col-wide"));
            expect(wide).toEqual([r.cells[3], r.cells[4], r.cells[5]]);
        }
        const wideHead = [...view.root.querySelectorAll("thead .col-wide")].map(
            (c) => c.textContent,
        );
        expect(wideHead).toEqual(["Duration", "Out", "Err"]);
    });

    it("gives each exit cell its text and class", () => {
        const { view } = showEnded("ended-full");
        const exits = [1, 2, 3, 4, 5, 6].map((seq) => {
            const cell = exitCell(view.root, seq);
            return [cell.textContent, [...cell.classList].filter((c) => c !== "exit")];
        });
        expect(exits).toEqual([
            ["0", []],
            ["1", ["bad"]],
            ["OOM", ["bad"]],
            ["cancelled", ["muted"]],
            ["lost", ["bad"]],
            ["0", []],
        ]);

        const t = make();
        t.view.setJobs(runningJobs(), NOW);
        const running = exitCell(t.view.root, 4);
        expect(running.textContent).toBe("running");
        expect(running.querySelector("span.dot")).not.toBeNull();
        expect(running.classList.contains("bad")).toBe(false);
    });

    it("keeps a running row's dot across snapshots that do not change it", () => {
        const t = make();
        t.view.setJobs(runningJobs(), NOW);
        const dot = exitCell(t.view.root, 4).querySelector("span.dot");
        expect(dot).not.toBeNull();
        t.view.setJobs(runningJobs(), new Date(NOW.getTime() + 10_000));
        expect(exitCell(t.view.root, 4).querySelector("span.dot")).toBe(dot);
        expect(exitCell(t.view.root, 4).textContent).toBe(copy.exitCell.running);
    });

    it("puts the cut notice first in a cut job's block", () => {
        const { view } = showEnded("ended-full");
        expect(plain(notes(view.root, 6))).toBe("Earlier output not kept (1.2 MiB)");
    });

    it("says the output is saving in place of the rows, in the muted tone of a wait", () => {
        const pending = showEnded("ended-pending");
        const note = pending.view.root.querySelector<HTMLElement>(".commands-note")!;
        expect(note.textContent).toBe("Saving output…");
        expect(note.hidden).toBe(false);
        expect(note.classList.contains("warn")).toBe(false);
        expect(pending.view.root.querySelector<HTMLElement>("table")!.hidden).toBe(true);
        expect(expandAll(pending.view.root).closest("[hidden]")).not.toBeNull();
    });

    it("keeps the commands and how they exited when their output expired, with no copy", () => {
        const { view } = showEnded("ended-output-expired");
        const note = view.root.querySelector<HTMLElement>(".commands-note")!;
        expect(note.textContent).toBe("The output expired before it was saved.");
        expect(note.classList.contains("warn")).toBe(true);
        const table = view.root.querySelector<HTMLElement>("table")!;
        expect(table.hidden).toBe(false);
        expect(table.classList.contains("no-output")).toBe(true);
        expect(expandAll(view.root).closest("[hidden]")).toBeNull();
        expect(rows(view.root).map((r) => r.dataset.seq)).toEqual(["1", "2"]);
        expect(cellTexts(view.root, 2).slice(1, 3)).toEqual(["npm run build", "0"]);
        // The stylesheet hides these, since there is no output to copy or show
        expect(view.root.querySelectorAll("td.copy .copy-output")).toHaveLength(2);
        const open = detail(view.root, 2);
        expect(open.querySelector(".term-cmd")!.textContent).toBe("$ npm run build");
        expect(open.querySelector(".copy-command")).not.toBeNull();
        expect(footer(view.root, 2)[0]).toBe("exit 0");

        const complete = showEnded("ended-full");
        expect(complete.view.root.querySelector("table")!.classList.contains("no-output")).toBe(
            false,
        );
    });

    it("keeps the rows a running view streamed when the end leaves its output saving", () => {
        const t = make();
        t.view.setJobs(runningJobs(), NOW);
        t.view.apply(4, { type: "out", frame: { s: "o", t: "hello\n", cr: false }, cursor: "c1" });
        t.scheduler.flush();
        t.view.setOutput("pending");
        const note = t.view.root.querySelector<HTMLElement>(".commands-note")!;
        expect(note.hidden).toBe(false);
        expect(note.textContent).toBe(copy.savingOutput);
        expect(t.view.root.querySelector<HTMLElement>("table")!.hidden).toBe(false);
        expect(expandAll(t.view.root).closest("[hidden]")).toBeNull();
        expect(lineTexts(t.view.root, 4)).toEqual(["hello"]);
    });

    it("keeps the rows of partial output under a warning", () => {
        const { view } = showEnded("ended-partial");
        const note = view.root.querySelector<HTMLElement>(".commands-note")!;
        expect(note.textContent).toBe(copy.outputPartial);
        expect(note.classList.contains("warn")).toBe(true);
        const table = view.root.querySelector<HTMLElement>("table")!;
        expect(table.hidden).toBe(false);
        expect(note.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(rows(view.root)).toHaveLength(2);
    });

    it("shows the rows once pending output is saved", () => {
        const t = make();
        const pending = parseGetBody(scenarios["ended-pending"].gets[0]!.body);
        const complete = parseGetBody(scenarios["ended-pending"].gets[2]!.body);
        if (pending.state !== "ended" || complete.state !== "ended") throw new Error("ended");
        t.view.setOutput(pending.record.output);
        t.view.setJobs(pending.record.jobs, NOW);
        t.scheduler.flush();
        expect(lineTexts(t.view.root, 2)).toEqual([]);
        t.view.setOutput(complete.record.output);
        t.view.setJobs(complete.record.jobs, NOW);
        t.scheduler.flush();
        expect(t.view.root.querySelector<HTMLElement>(".commands-note")!.hidden).toBe(true);
        expect(t.view.root.querySelector<HTMLElement>("table")!.hidden).toBe(false);
        expect(lineTexts(t.view.root, 2)).toContain("✓ built in 4.12s");
    });

    it("replaces live text with the record's frames when they arrive", () => {
        const t = make();
        const record = ended("ended-full");
        const live = record.jobs.map((job) => ({ ...job, frames: null }));
        t.view.setJobs(live, NOW);
        t.view.apply(6, {
            type: "out",
            frame: { s: "o", t: "Collecting", cr: false },
            cursor: "c1",
        });
        t.scheduler.flush();
        t.view.setJobs(record.jobs, NOW);
        t.scheduler.flush();
        expect(t.view.buffer(6).text().startsWith("Collecting torch==2.5.1\n")).toBe(true);
        expect(lineTexts(t.view.root, 6)[0]).toBe("Collecting torch==2.5.1");
        expect(lineTexts(t.view.root, 6)).toHaveLength(5);
    });

    it("opens all six with Expand all, then closes them with Collapse all", () => {
        const { view, scheduler } = showEnded("ended-full");
        const toggled = vi.fn();
        view.onToggle(toggled);
        const button = expandAll(view.root);
        expect(shownLabel(button)).toEqual([copy.expandAll]);
        expect(button.textContent).toBe(`${copy.expandAll}${copy.collapseAll}`);
        button.click();
        scheduler.flush();
        for (const seq of [1, 2, 3, 4, 5, 6]) {
            expect(toggle(view.root, seq).getAttribute("aria-expanded")).toBe("true");
            expect(detail(view.root, seq).hidden).toBe(false);
        }
        expect(lineTexts(view.root, 1)).toContain("added 214 packages in 11s");
        expect(shownLabel(button)).toEqual([copy.collapseAll]);
        expect(toggled.mock.calls).toEqual([1, 2, 3, 4, 5].map((seq) => [seq, true]));
        expect(view.openSeqs()).toEqual([5, 4, 3, 2, 1, 6]);

        button.click();
        for (const seq of [1, 2, 3, 4, 5, 6]) expect(detail(view.root, seq).hidden).toBe(true);
        expect(shownLabel(button)).toEqual([copy.expandAll]);
        expect(view.openSeqs()).toEqual([]);
    });

    it("toggles one row and reports it, most recently opened first", () => {
        const { view } = showEnded("ended-full");
        const toggled = vi.fn();
        view.onToggle(toggled);
        toggle(view.root, 2).click();
        expect(detail(view.root, 2).hidden).toBe(false);
        expect(toggle(view.root, 2).getAttribute("aria-expanded")).toBe("true");
        expect(view.openSeqs()).toEqual([2, 6]);
        toggle(view.root, 6).click();
        expect(view.openSeqs()).toEqual([2]);
        expect(toggled.mock.calls).toEqual([
            [2, true],
            [6, false],
        ]);
    });

    it("ticks a running row's time with now()", () => {
        const t = make();
        t.view.setJobs(runningJobs(), NOW);
        t.scheduler.flush();
        const time = (seq: number) => plain(row(t.view.root, seq).cells[3]!.textContent);
        expect(time(4)).toBe("30 s");
        expect(time(2)).toBe("9 s");
        t.setNow(new Date(NOW.getTime() + 5_000));
        t.scheduler.flush();
        expect(time(4)).toBe("35 s");
        expect(time(3)).toBe("1 min 5 s");
        expect(time(2)).toBe("9 s");
    });

    it("opens the last row only on the first setJobs and appends new rows at the end", () => {
        const t = make();
        const jobs = runningJobs();
        t.view.setJobs(jobs.slice(0, 3), NOW);
        expect(t.view.openSeqs()).toEqual([3]);
        t.view.setJobs(jobs, NOW);
        expect(rows(t.view.root).map((r) => r.dataset.seq)).toEqual(["1", "2", "3", "4"]);
        expect(t.view.openSeqs()).toEqual([3]);
        expect(toggle(t.view.root, 4).getAttribute("aria-expanded")).toBe("false");
    });

    it("appends an out frame to that row's block", () => {
        const t = make();
        t.view.setJobs(runningJobs(), NOW);
        t.scheduler.flush();
        t.view.apply(4, {
            type: "out",
            frame: { s: "o", t: "hello\nwor", cr: false },
            cursor: "c1",
        });
        t.view.apply(4, { type: "out", frame: { s: "e", t: "ld\n", cr: false }, cursor: "c2" });
        t.scheduler.flush();
        expect(lineTexts(t.view.root, 4)).toEqual(["hello", "wor", "ld"]);
        expect(lineTexts(t.view.root, 3)).toEqual([]);
        expect(t.view.buffer(4).text()).toBe("hello\nwor\nld");
    });

    it("keeps a closed row's frames for when it opens", () => {
        const t = make();
        t.view.setJobs(runningJobs(), NOW);
        t.view.apply(1, { type: "out", frame: { s: "o", t: "cloned\n", cr: false }, cursor: "c1" });
        toggle(t.view.root, 1).click();
        t.scheduler.flush();
        expect(lineTexts(t.view.root, 1)).toEqual(["cloned"]);
    });

    it("fills the exit cell and the last line from an exit frame", () => {
        const t = make();
        t.view.setJobs(runningJobs(), NOW);
        toggle(t.view.root, 3).click();
        t.scheduler.flush();
        t.setNow(new Date(NOW.getTime() + 2_000));
        t.view.apply(3, { type: "exit", exitCode: 2, oom: false, peakMib: 96 });
        t.scheduler.flush();
        expect(exitCell(t.view.root, 3).textContent).toBe("2");
        expect(exitCell(t.view.root, 3).classList.contains("bad")).toBe(true);
        expect(footer(t.view.root, 3)).toEqual(["exit 2", "1 min 2 s", "peak 96 MiB"]);
        t.setNow(new Date(NOW.getTime() + 9_000));
        t.scheduler.flush();
        expect(plain(row(t.view.root, 3).cells[3]!.textContent)).toBe("1 min 2 s");
    });

    it("ticks an open running row's last line with its time cell", () => {
        const t = make();
        t.view.setJobs(runningJobs(), NOW);
        toggle(t.view.root, 3).click();
        t.scheduler.flush();
        t.scheduler.flush();
        expect(footer(t.view.root, 3)).toEqual(["running", "1 min 0 s"]);
        t.setNow(new Date(NOW.getTime() + 2_000));
        t.scheduler.flush();
        t.scheduler.flush();
        expect(footer(t.view.root, 3)).toEqual(["running", "1 min 2 s"]);
        expect(plain(row(t.view.root, 3).cells[3]!.textContent)).toBe("1 min 2 s");
    });

    it("shows the skipped, waiting and limit notices", () => {
        const t = make();
        t.view.setJobs(runningJobs(), NOW);
        t.view.apply(4, { type: "skip", outBytes: 12_000, errBytes: 345, cursor: "c1" });
        t.view.setLive(4, "waiting");
        t.scheduler.flush();
        expect(notes(t.view.root, 4)).toBe(`${copy.waiting}${copy.skipped(12_345)}`);
        const tones = () =>
            [...detail(t.view.root, 4).querySelectorAll(".term-notes p")].map((p) => p.className);
        expect(tones()).toEqual(["muted", "warn"]);
        t.view.setLive(4, "limit");
        t.scheduler.flush();
        expect(notes(t.view.root, 4)).toBe(`${copy.limit}${copy.skipped(12_345)}`);
        expect(tones()).toEqual(["warn", "warn"]);
        t.view.setLive(4, "streaming");
        t.scheduler.flush();
        expect(notes(t.view.root, 4)).toBe(copy.skipped(12_345));
    });

    it("copies the row's output", () => {
        const { view, clipboard } = showEnded("ended-full");
        row(view.root, 1).querySelector<HTMLButtonElement>("button.copy-button")!.click();
        expect(clipboard.writeText).toHaveBeenCalledWith(
            "\nadded 214 packages in 11s\n\n38 packages are looking for funding",
        );
    });

    it("says Copied, cut for output the page holds only part of", async () => {
        const { view, scheduler } = showEnded("ended-full");
        const copied = async (seq: number) => {
            row(view.root, seq).querySelector<HTMLButtonElement>("button.copy-button")!.click();
            await Promise.resolve();
            await Promise.resolve();
            scheduler.flush();
            const button = row(view.root, seq).querySelector("button.copy-button")!;
            return shownLabel(button as HTMLElement);
        };
        // Row 6 lost its first 1.2 MiB
        expect(await copied(6)).toEqual([copy.copiedPartial]);
        expect(await copied(1)).toEqual([copy.copied]);
    });

    it("loads a closed row's output on Copy, rather than say Copied over nothing", async () => {
        const t = make();
        t.view.setJobs(runningJobs(), NOW);
        t.scheduler.flush();
        const toggled = vi.fn();
        t.view.onToggle(toggled);
        // Row 2 finished with output, which a snapshot does not carry
        expect(toggle(t.view.root, 2).getAttribute("aria-expanded")).toBe("false");
        const button = row(t.view.root, 2).querySelector<HTMLButtonElement>("button.copy-button")!;
        button.click();
        await Promise.resolve();
        t.scheduler.flush();
        expect(t.clipboard.writeText).not.toHaveBeenCalled();
        expect(shownLabel(button)).toEqual([copy.loading]);
        expect(toggle(t.view.root, 2).getAttribute("aria-expanded")).toBe("true");
        expect(toggled.mock.calls).toEqual([[2, true]]);
        expect(t.view.openSeqs()[0]).toBe(2);

        t.view.apply(2, { type: "out", frame: { s: "o", t: "lint ok\n", cr: false }, cursor: "c" });
        button.click();
        await Promise.resolve();
        expect(t.clipboard.writeText).toHaveBeenCalledExactlyOnceWith("lint ok");
    });

    it("copies the command and the output from the open row's command line", () => {
        const { view, clipboard } = showEnded("ended-full");
        const head = detail(view.root, 6).querySelector(".term-head")!;
        expect([...head.children].map((c) => c.className)).toEqual([
            "term-cmd",
            "copy-button copy-command",
            "copy-button copy-output",
        ]);
        head.querySelector<HTMLButtonElement>("button.copy-command")!.click();
        expect(clipboard.writeText).toHaveBeenLastCalledWith(
            "pip install torch==2.5.1 --progress-bar on",
        );
        head.querySelector<HTMLButtonElement>("button.copy-output")!.click();
        expect(clipboard.writeText).toHaveBeenCalledWith(view.buffer(6).text());
        expect(view.buffer(6).text()).toContain("Successfully installed torch-2.5.1");
    });

    it("sets hostile commands and output as text", () => {
        const { view, scheduler } = showEnded("ended-hostile");
        expandAll(view.root).click();
        scheduler.flush();
        expect(view.root.querySelector("img")).toBeNull();
        expect(view.root.querySelector("a")).toBeNull();
        expect(lineTexts(view.root, 2)).toContain(
            'Bugnet support: <a href="https://evil.example">verify your keys</a>',
        );
        expect(toggle(view.root, 1).textContent).toBe(
            "echo '<img src=x onerror=alert(1)>' # zz-sample-ended-hostile",
        );
    });

    it("shows one line of a multi-line command and names a missing one", () => {
        const t = make();
        const [job] = runningJobs();
        t.view.setJobs(
            [
                { ...job!, seq: 1, command: "cat <<EOF\nhello\nEOF" },
                { ...job!, seq: 2, command: null },
            ],
            NOW,
        );
        expect(toggle(t.view.root, 1).textContent).toBe(`cat <<EOF${copy.moreLines}`);
        expect(toggle(t.view.root, 2).textContent).toBe(copy.noCommand);
        // The stylesheet cuts this span to one line with an ellipsis
        const text = toggle(t.view.root, 1).querySelector("span.cmd-text");
        expect(text?.textContent).toBe(`cat <<EOF${copy.moreLines}`);
    });

    it("removes itself and stops ticking on destroy", () => {
        const t = make();
        t.view.setJobs(runningJobs(), NOW);
        t.view.destroy();
        expect(document.body.contains(t.view.root)).toBe(false);
        t.scheduler.flush();
        expect(t.scheduler.queued()).toBe(0);
    });
});
