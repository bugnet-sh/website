import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { SummaryState } from "../../lib/stats/client";
import { parseSummary } from "../../lib/stats/parse";
import { fakeSummary } from "../../lib/stats/testing/fake-data";
import type { StatsSummary } from "../../lib/stats/types";
import { StatsState } from "../stats/stats-provider";
import { How, howTerminals } from "./how";
import {
    CHAR_MS,
    DONE_MS,
    LINE_MS,
    PAUSE_MS,
    REST_MS,
    START_MS,
    typed,
    typing,
} from "./how-timeline";

const fake = parseSummary(fakeSummary(1, "normal")) as StatsSummary;
const small = (priceMicros: number) => ({
    id: "small-10m",
    vcpu: 2,
    memoryMiB: 2048,
    diskGiB: 10,
    gpu: null,
    minutes: 10,
    priceMicros,
});
/** The feed, with small-10m at this price */
const priced = (priceMicros: number): SummaryState => ({
    data: { ...fake, packages: [small(priceMicros)] },
    updatedAt: new Date(),
    failedAt: null,
});
const inFeed = (summary: SummaryState, ui: ReactElement) => (
    <StatsState summary={summary}>{ui}</StatsState>
);

/** The terminals the tests below type, at the 0.05 their timings were measured with */
const terminals = howTerminals("0.05");

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

type Observer = { cb: IntersectionObserverCallback; targets: Element[] };

function setup({ reduced = false, stacked = false } = {}) {
    const observers: Observer[] = [];
    vi.stubGlobal(
        "IntersectionObserver",
        class {
            targets: Element[] = [];
            cb: IntersectionObserverCallback;
            constructor(cb: IntersectionObserverCallback) {
                this.cb = cb;
                observers.push(this);
            }
            observe(el: Element) {
                this.targets.push(el);
            }
            unobserve(el: Element) {
                this.targets = this.targets.filter((target) => target !== el);
            }
            disconnect() {
                this.targets = [];
            }
        },
    );
    vi.stubGlobal("matchMedia", (query: string) => ({
        matches: query.includes("reduce") ? reduced : stacked,
        addEventListener() {},
        removeEventListener() {},
    }));
    vi.useFakeTimers();
    const { container, unmount } = render(inFeed(priced(50_000), <How />));
    const steps = [...container.querySelectorAll<HTMLElement>("[data-how-step]")];
    return { observers, steps, unmount };
}

const see = (observer: Observer, targets: Element[], isIntersecting = true) =>
    act(() =>
        observer.cb(
            targets.map((target) => ({ isIntersecting, target }) as never),
            observer as never,
        ),
    );

/** What a terminal shows: its drawn lines, with the cursor as a block */
const view = (step: HTMLElement) =>
    [...step.querySelectorAll("[data-how-line]")].flatMap((line) =>
        line.hasAttribute("data-off")
            ? []
            : [line.textContent + (line.hasAttribute("data-caret") ? "█" : "")],
    );

const playing = (steps: HTMLElement[]) => steps.map((step) => step.hasAttribute("data-playing"));

const ask = [
    "$ claude",
    "> Test this in a sandbox",
    "",
    "● bugnet_assess(repo)",
    "  ⎿  fits   small-10m",
    "     price  0.05 USDC",
    "     check  free",
];

describe("How's terminals", () => {
    it("type what a person or the agent writes and print what comes back", () => {
        const { steps } = setup({ reduced: true });
        const lines = steps.map(view);
        const kinds = terminals.map((lines) => lines.map((line) => line.kind));
        expect(lines.map((step, i) => step.map((text, j) => [kinds[i]![j], text]))).toEqual([
            [
                ["type", "$ claude"],
                ["type", "> Test this in a sandbox"],
                ["print", ""],
                ["type", "● bugnet_assess(repo)"],
                ["print", "  ⎿  fits   small-10m"],
                ["print", "     price  0.05 USDC"],
                ["print", "     check  free"],
            ],
            [
                ["type", "● bugnet_start("],
                ["more", '  packageId: "small-10m",'],
                ["more", '  confirmPriceUsd: "0.05")'],
                ["print", ""],
                ["print", "Do you want to proceed?"],
                ["print", "❯ 1. Yes"],
                ["print", "  2. No"],
            ],
            [
                ["type", "● Pay 0.05 USDC on Solana"],
                ["more", "  pay.bugnet.sh/o/ord_7Kq2"],
                ["print", ""],
                ["type", "> Paid"],
                ["print", ""],
                ["type", "● bugnet_redeem(ord_7Kq2)"],
                ["print", "  ⎿  paid  tx 4vJ9…Kq2L"],
            ],
            [
                ["type", "● bugnet_exec(npm test)"],
                ["print", "  ⎿  exit 0"],
                ["print", "     Tests: 42 passed"],
                ["print", ""],
                ["type", "● bugnet_status"],
                ["print", "  ⎿  deleted in 9 min"],
            ],
        ]);
    });

    it("show their prompt or bullet at once and type the rest", () => {
        expect(terminals.map((lines) => lines.map((line) => line.lead))).toEqual([
            [2, 2, 0, 2, 0, 0, 0],
            [2, 2, 2, 0, 0, 0, 0],
            [2, 2, 0, 2, 0, 2, 0],
            [2, 0, 0, 0, 2, 0],
        ]);
    });

    it("fill in a few seconds, a character or a printed line at a time", () => {
        const C = CHAR_MS;
        expect(terminals.map((lines) => typed(typing(lines)))).toEqual([
            START_MS + (6 + 22 + 19) * C + 3 * PAUSE_MS + 2 * LINE_MS,
            START_MS + (13 + 1 + 23 + 1 + 24) * C + PAUSE_MS + 2 * LINE_MS,
            START_MS + (23 + 1 + 24 + 4 + 23) * C + 3 * PAUSE_MS,
            START_MS + (21 + 13) * C + 3 * PAUSE_MS + LINE_MS,
        ]);
    });

    it("draw the cursor as a box one cell in size, so it leaves no marks when it moves on", () => {
        const { steps } = setup({ reduced: true });
        for (const line of steps.flatMap((step) => [...step.querySelectorAll("[data-how-line]")])) {
            const caret = line.className.split(" ").filter((c) => c.startsWith("data-caret:"));
            expect(caret).toEqual(
                expect.arrayContaining([
                    "data-caret:after:inline-block",
                    "data-caret:after:h-(--how-code-line)",
                    "data-caret:after:w-[1ch]",
                ]),
            );
            expect(line.className).not.toContain("█");
        }
    });
});

describe("HowPlayer in one row", () => {
    it("types the playing terminal while every other one stays drawn", () => {
        const { observers, steps, unmount } = setup();
        const drawn = steps.map(view);
        expect(drawn[0]).toEqual(ask);
        expect(playing(steps)).toEqual([false, false, false, false]);

        see(observers[0]!, [observers[0]!.targets[0]!]);
        vi.advanceTimersByTime(0);
        expect(playing(steps)).toEqual([true, false, false, false]);
        expect(view(steps[0]!)).toEqual(["█"]);
        expect(steps.slice(1).map(view)).toEqual(drawn.slice(1));

        vi.advanceTimersByTime(START_MS);
        expect(view(steps[0]!)).toEqual(["$ █"]);
        vi.advanceTimersByTime(3 * CHAR_MS);
        expect(view(steps[0]!)).toEqual(["$ cla█"]);
        // The typed word keeps its colour
        expect(steps[0]!.querySelector(".text-claude")?.textContent).toBe("cla");

        // The call is typed, and its result prints whole after a pause
        vi.advanceTimersByTime(3 * CHAR_MS + PAUSE_MS + 22 * CHAR_MS + PAUSE_MS + 19 * CHAR_MS);
        expect(view(steps[0]!)).toEqual([...ask.slice(0, 3), `${ask[3]}█`]);
        vi.advanceTimersByTime(PAUSE_MS);
        expect(view(steps[0]!)).toEqual([...ask.slice(0, 4), `${ask[4]}█`]);
        vi.advanceTimersByTime(LINE_MS);
        expect(view(steps[0]!).at(-1)).toBe(`${ask[5]}█`);
        vi.advanceTimersByTime(LINE_MS);
        expect(view(steps[0]!)).toEqual([...ask.slice(0, 6), `${ask[6]}█`]);

        // Full, it holds lit, then the next step plays and the first is drawn again
        vi.advanceTimersByTime(DONE_MS - 1);
        expect(playing(steps)).toEqual([true, false, false, false]);
        vi.advanceTimersByTime(1);
        expect(playing(steps)).toEqual([false, true, false, false]);
        expect(view(steps[0]!)).toEqual(drawn[0]);
        expect(view(steps[1]!)).toEqual(["█"]);

        // After the fourth, a rest with every terminal drawn, then step one again
        const rest = terminals.slice(1).reduce((sum, lines) => {
            const shots = typing(lines);
            return sum + typed(shots) + shots.at(-1)!.ms;
        }, 0);
        vi.advanceTimersByTime(rest);
        expect(playing(steps)).toEqual([false, false, false, false]);
        expect(steps.map(view)).toEqual(drawn);
        vi.advanceTimersByTime(REST_MS);
        expect(playing(steps)).toEqual([true, false, false, false]);
        expect(view(steps[0]!)).toEqual(["█"]);

        unmount();
        expect(steps.map(view)).toEqual(drawn);
        expect(playing(steps)).toEqual([false, false, false, false]);
    });

    it("holds still off screen and goes on where it stopped", () => {
        const { observers, steps } = setup();
        const list = observers[0]!.targets[0]!;
        see(observers[0]!, [list]);
        vi.advanceTimersByTime(START_MS + 2 * CHAR_MS);
        expect(view(steps[0]!)).toEqual(["$ cl█"]);
        see(observers[0]!, [list], false);
        vi.advanceTimersByTime(10_000);
        expect(view(steps[0]!)).toEqual(["$ cl█"]);
        see(observers[0]!, [list]);
        vi.advanceTimersByTime(CHAR_MS);
        expect(view(steps[0]!)).toEqual(["$ cla█"]);
    });
});

describe("HowPlayer stacked", () => {
    const whole = (step: number) => typed(typing(terminals[step]!)) + DONE_MS;

    it("types one terminal at a time as they come into view, the others drawn", () => {
        const { observers, steps } = setup({ stacked: true });
        const drawn = steps.map(view);
        const observer = observers[0]!;
        const [first, second, third, fourth] = observer.targets;

        see(observer, [third!]);
        expect(playing(steps)).toEqual([false, false, true, false]);
        expect(view(steps[2]!)).toEqual(["█"]);
        vi.advanceTimersByTime(START_MS);
        expect(view(steps[2]!)).toEqual(["● █"]);

        // The fourth comes into view while the third types, and waits its turn drawn
        see(observer, [fourth!]);
        expect(playing(steps)).toEqual([false, false, true, false]);
        expect(view(steps[3]!)).toEqual(drawn[3]);

        vi.advanceTimersByTime(whole(2) - START_MS - 1);
        expect(view(steps[2]!).at(-1)).toBe(`${drawn[2]!.at(-1)}█`);
        vi.advanceTimersByTime(1);
        expect(playing(steps)).toEqual([false, false, false, true]);
        expect(view(steps[2]!)).toEqual(drawn[2]);
        expect(view(steps[3]!)).toEqual(["█"]);

        vi.advanceTimersByTime(whole(3));
        expect(playing(steps)).toEqual([false, false, false, false]);
        expect(steps.map(view)).toEqual(drawn);
        // Each types once, so only the two still to type are watched
        expect(observer.targets).toEqual([first, second]);
    });

    it("lets a terminal that left the view before its turn wait until it is back", () => {
        const { observers, steps } = setup({ stacked: true });
        const observer = observers[0]!;
        const [first, second] = observer.targets;

        see(observer, [first!, second!]);
        expect(playing(steps)).toEqual([true, false, false, false]);
        see(observer, [second!], false);
        vi.advanceTimersByTime(whole(0));
        expect(playing(steps)).toEqual([false, false, false, false]);

        see(observer, [second!]);
        expect(playing(steps)).toEqual([false, true, false, false]);
        expect(view(steps[1]!)).toEqual(["█"]);
    });
});

it("draws every terminal and moves nothing under reduced motion", () => {
    const { observers, steps } = setup({ reduced: true });
    const drawn = steps.map(view);
    expect(observers).toHaveLength(0);
    vi.advanceTimersByTime(30_000);
    expect(steps.map(view)).toEqual(drawn);
    expect(drawn[0]).toEqual(ask);
    expect(playing(steps)).toEqual([false, false, false, false]);
});

describe("How's price", () => {
    it("quotes small-10m's live price in all three places", () => {
        const { container } = render(inFeed(priced(3_355), <How />));
        const text = container.textContent ?? "";
        expect(text).toContain("price  0.003355 USDC");
        expect(text).toContain('confirmPriceUsd: "0.003355")');
        expect(text).toContain("● Pay 0.003355 USDC on Solana");
        expect(text).not.toContain("0.05");
    });

    it("draws a pulsing bar for the price while the feed loads, and types nothing", () => {
        const observers: unknown[] = [];
        vi.stubGlobal(
            "IntersectionObserver",
            class {
                constructor() {
                    observers.push(this);
                }
                observe() {}
                disconnect() {}
            },
        );
        vi.stubGlobal("matchMedia", () => ({
            matches: false,
            addEventListener() {},
            removeEventListener() {},
        }));
        const { container } = render(
            inFeed({ data: null, updatedAt: null, failedAt: null }, <How />),
        );
        expect(container.textContent).not.toMatch(/\d\.\d+ USDC/);
        expect(container.querySelectorAll("[data-how-line] .animate-pulse")).toHaveLength(3);
        expect(observers).toHaveLength(0);
    });

    it("keeps the bars still once the feed is off", () => {
        const { container } = render(
            inFeed({ data: null, updatedAt: null, failedAt: new Date() }, <How />),
        );
        expect(container.querySelectorAll("[data-how-line] .animate-pulse")).toHaveLength(0);
        expect(container.querySelectorAll("[data-how-line] .w-\\[8ch\\]")).toHaveLength(3);
    });
});
