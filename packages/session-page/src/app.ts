/**
 * The session page: reads the link, asks the sessions route at once, and shows whatever it
 * answers (session-page-ui.md 4). Until the first answer comes, the page shows the heading alone.
 *
 * A running session is asked for again every 10 s and its commands stream live. An ended one is
 * asked for again only while its output is being saved, an x402 payment settles or its allowance
 * waits for the refund. Every answer that reaches a final state (expired, not found, deleted, too
 * new) stops the timers and the streams for good, and answers still in flight from before that
 * are dropped.
 */
import { createApi, type GetResult } from "./api.ts";
import { copy } from "./copy.ts";
import { formatClock, formatLeft } from "./format.ts";
import { readLink, sessionKeyStore, type Gone } from "./link.ts";
import { createLive, type Live } from "./live.ts";
import { allowanceOpen, settlingCalls } from "./map/model.ts";
import type { SessionRecord, Snapshot } from "./payload.ts";
import { createCommandsView, type CommandsView } from "./render/commands.ts";
import type { Clipboard } from "./render/controls.ts";
import { reportError } from "./report.ts";
import {
    createMapSection,
    createSessionHead,
    createSessionMeta,
    emptyMapSection,
    mapLaterLine,
    messageLine,
    retryButton,
    type MapSection,
    type SessionMeta,
} from "./render/session.ts";
import type { Scheduler } from "./schedule.ts";

export interface PageEnv {
    doc: Document;
    location: { pathname: string; hash: string };
    replacePath(path: string): void;
    storage: Storage | null;
    fetch: typeof fetch;
    now(): Date;
    clipboard: Clipboard;
    scheduler: Scheduler;
    setTimer(cb: () => void, ms: number): number;
    clearTimer(id: number): void;
}

const RUNNING_EVERY_MS = 10_000;
const SAVING_EVERY_MS = 5_000;
// Two minutes of asking every 5 s, then every 30 s
const SAVING_FAST_ASKS = 24;
const SAVING_SLOW_MS = 30_000;
const SETTLING_EVERY_MS = 30_000;
// A settling call is confirmed within minutes, so one still settling past this waits for a reload
const SETTLING_FOR_MS = 30 * 60_000;
const FAILURES_BEFORE_NOTICE = 3;
// The times row counts down in minutes and hours
const CLOCK_MS = 60_000;
// The route's per-IP limit on live streams
const MAX_STREAMS = 4;
const STREAM_RETRY_MS = 2_000;
// A retry says it is loading for at least this long, so a quick same answer still shows a try
const RETRY_BUSY_MS = 400;

type Mode = "loading" | "message" | "running" | "ended";

const goneLine: Record<Gone, string> = {
    deleted: copy.deleted,
    expired: copy.expired,
    "not-found": copy.notFound,
};

interface View {
    meta: SessionMeta;
    middle: HTMLElement;
    map: MapSection | null;
    commands: CommandsView;
}

export function startPage(env: PageEnv): { destroy(): void } {
    const { doc } = env;
    const found = doc.getElementById("app");
    if (found === null) throw new Error("the page has no #app element");
    const root: HTMLElement = found;
    const store = sessionKeyStore(env.storage);
    const link = readLink(env.location, store, (path) => env.replacePath(path));
    const head = createSessionHead(doc);

    if (link.kind !== "ok") {
        const text =
            link.kind === "gone"
                ? goneLine[link.why]
                : link.kind === "no-key"
                  ? copy.noKey
                  : copy.notALink;
        root.replaceChildren(head.root, messageLine(doc, text));
        return { destroy() {} };
    }

    const { id } = link;
    const api = createApi({ fetch: env.fetch, id, key: link.key });

    let mode: Mode = "loading";
    let view: View | null = null;
    let live: Live | null = null;
    // Seqs whose stream state the commands view shows, reset when the streams stop
    const liveSeqs = new Set<number>();
    let runningSeqs: number[] = [];
    // Bumped on every stop, so an answer to an older ask is dropped
    let epoch = 0;
    let timer: number | null = null;
    let clock: number | null = null;
    // The times row's parts at a given time, from the last answer
    let timesAt: ((now: Date) => string[]) | null = null;
    let destroyed = false;
    // The server clock minus the viewer's, so a wrong viewer clock never skews time left
    let offsetMs = 0;
    let failures = 0;
    let saving = false;
    let savingAsks = 0;
    // Asks for settling payments and the refund end before this server time; null when none waits
    let settlingUntil: number | null = null;
    let status: { text: string; running: boolean } | null = null;
    // Set when the streams stopped for the session's end, so the ask that follows opens none
    let streamsRest = false;

    const serverNow = () => new Date(env.now().getTime() + offsetMs);

    function paintStatus(): void {
        if (status === null) return;
        const reconnecting = failures >= FAILURES_BEFORE_NOTICE;
        head.setStatus(
            reconnecting ? copy.reconnecting : status.text,
            !reconnecting && status.running,
        );
    }

    function clearAsk(): void {
        if (timer !== null) env.clearTimer(timer);
        timer = null;
    }

    function paintTimes(): void {
        if (view !== null && timesAt !== null) view.meta.setTimes(timesAt(serverNow()));
    }

    function startClock(): void {
        if (clock !== null) return;
        clock = env.setTimer(() => {
            clock = null;
            paintTimes();
            startClock();
        }, CLOCK_MS);
    }

    function stopClock(): void {
        if (clock !== null) env.clearTimer(clock);
        clock = null;
    }

    function askIn(ms: number | null): void {
        clearAsk();
        if (ms === null) return;
        timer = env.setTimer(() => {
            timer = null;
            void ask();
        }, ms);
    }

    // Saving output and settling payments share the one timer, so no answer is asked for twice
    function nextAsk(): number | null {
        if (mode === "running") return RUNNING_EVERY_MS;
        if (mode !== "ended") return null;
        const waits: number[] = [];
        if (saving) waits.push(savingAsks++ < SAVING_FAST_ASKS ? SAVING_EVERY_MS : SAVING_SLOW_MS);
        const settleAt = serverNow().getTime() + SETTLING_EVERY_MS;
        if (settlingUntil !== null && settleAt < settlingUntil) waits.push(SETTLING_EVERY_MS);
        return waits.length === 0 ? null : Math.min(...waits);
    }

    // A drawing bug is not a network failure, so the view stays as it is
    function applySafely(result: GetResult): void {
        try {
            apply(result);
        } catch (err) {
            reportError(err);
            // A throw after enter() skips the ask that apply ends with; one already set stays
            if (!destroyed && timer === null) askIn(nextAsk());
        }
    }

    async function ask(): Promise<void> {
        const at = epoch;
        const result = await api.get();
        if (destroyed || at !== epoch) return;
        applySafely(result);
    }

    async function retry(): Promise<void> {
        const at = epoch;
        const startedAt = env.now().getTime();
        const result = await api.get();
        if (destroyed || at !== epoch) return;
        const wait = Math.max(0, RETRY_BUSY_MS - (env.now().getTime() - startedAt));
        env.setTimer(() => {
            if (!destroyed && at === epoch) applySafely(result);
        }, wait);
    }

    function apply(result: GetResult): void {
        if (!result.ok) {
            if (result.error === "not-found") finish(copy.notFound, "not-found");
            else if (result.error === "bad-payload") finish(copy.tooNew, null);
            else if (view !== null) failed();
            else offerRetry(result.error === "rate-limited" ? copy.rateLimited : copy.offline);
            return;
        }
        const body = result.body;
        if (body.state === "expired") finish(copy.expired, "expired");
        else if (body.state === "too-new") finish(copy.tooNew, null);
        else {
            failures = 0;
            if (body.state === "running") showRunning(body.snapshot);
            else showEnded(body.record);
        }
    }

    // The view stays, since the next answer may well bring it up to date
    function failed(): void {
        failures++;
        paintStatus();
        askIn(nextAsk());
    }

    function stopLive(): void {
        live?.stopAll();
        live = null;
        for (const seq of liveSeqs) view?.commands.setLive(seq, "idle");
        liveSeqs.clear();
    }

    function stop(): void {
        epoch++;
        clearAsk();
        stopClock();
        stopLive();
    }

    function teardown(): void {
        view?.commands.destroy();
        view?.map?.destroy();
        view = null;
    }

    // A page that is gone for good keeps how it went in the key's place, for a reload
    function finish(text: string, gone: Gone | null): void {
        stop();
        if (gone !== null) store.markGone(id, gone);
        teardown();
        mode = "message";
        status = null;
        head.setStatus(null);
        const line = messageLine(doc, text);
        root.replaceChildren(head.root, line);
        line.focus();
    }

    function offerRetry(text: string): void {
        mode = "message";
        const line = messageLine(doc, text);
        root.replaceChildren(
            head.root,
            line,
            retryButton(doc, () => void retry()),
        );
        line.focus();
    }

    function wantLive(): void {
        if (live === null || view === null) return;
        live.setWanted([...new Set([...view.commands.openSeqs(), ...runningSeqs])]);
    }

    function startLive(): Live {
        return createLive({
            api,
            maxStreams: MAX_STREAMS,
            retryMs: STREAM_RETRY_MS,
            onFrame: (seq, frame) => view?.commands.apply(seq, frame),
            onState: (seq, state) => {
                liveSeqs.add(seq);
                view?.commands.setLive(seq, state);
            },
            // A stream answers 404 from the deadline on too, so only the record can tell
            // ended, expired and not found apart
            onGone: streamsEnded,
            onSessionEnd: () => {
                streamsEnded();
                // Until the record comes with the reason
                status = { text: copy.sandboxEnded, running: false };
                paintStatus();
            },
            setTimer: (cb, ms) => env.setTimer(cb, ms),
            clearTimer: (t) => env.clearTimer(t as number),
        });
    }

    // The record may say running for a few seconds past the end, and streams opened then would
    // end again at once, so they wait for the next regular ask
    function streamsEnded(): void {
        stop();
        streamsRest = true;
        void ask();
    }

    async function remove(): Promise<boolean> {
        // An ask answered after the delete would show a stale view or a not-found line
        epoch++;
        clearAsk();
        const result = await api.remove();
        if (destroyed) return true;
        if (result.ok) finish(copy.deleted, "deleted");
        else if (result.error === "not-found") finish(copy.notFound, "not-found");
        else {
            askIn(nextAsk());
            return false;
        }
        return true;
    }

    // A map that fails to draw leaves its caption, and the rest of the page goes on
    function drawMap(record: SessionRecord): MapSection | null {
        try {
            return createMapSection(doc, record, { now: serverNow, clipboard: env.clipboard });
        } catch (err) {
            reportError(err);
            return null;
        }
    }

    function swapMiddle(v: View, map: MapSection | null, middle: HTMLElement): void {
        v.map?.destroy();
        v.middle.replaceWith(middle);
        v.middle = middle;
        v.map = map;
    }

    // The heading row, the times and the commands stay across running and ended
    function enter(kind: "running" | "ended", record: SessionRecord | null): View {
        if (view !== null && mode === kind) {
            if (record !== null && view.map !== null) {
                try {
                    view.map.update(record);
                } catch (err) {
                    reportError(err);
                    swapMiddle(view, null, emptyMapSection(doc, record));
                }
            } else if (record !== null) {
                // The first draw failed; a later record may draw, and if not, the caption stays current
                const map = drawMap(record);
                swapMiddle(view, map, map !== null ? map.root : emptyMapSection(doc, record));
            }
            return view;
        }
        const map = record === null ? null : drawMap(record);
        const middle =
            map !== null
                ? map.root
                : record === null
                  ? mapLaterLine(doc)
                  : emptyMapSection(doc, record);
        if (view === null) {
            const commands = createCommandsView({
                doc,
                scheduler: env.scheduler,
                clipboard: env.clipboard,
                now: serverNow,
            });
            commands.onToggle(wantLive);
            view = { meta: createSessionMeta(doc, remove), middle, map, commands };
            root.replaceChildren(head.root, view.meta.root, middle, commands.root);
        } else {
            swapMiddle(view, map, middle);
        }
        mode = kind;
        // The heading is where a screen reader starts, and a sighted reader keeps their place
        head.heading.focus({ preventScroll: true });
        return view;
    }

    function showRunning(snapshot: Snapshot): void {
        offsetMs = snapshot.now.getTime() - env.now().getTime();
        const now = serverNow();
        const v = enter("running", null);
        status = { text: copy.running, running: true };
        paintStatus();
        timesAt = (at) => [
            copy.started(formatClock(snapshot.startedAt, at)),
            copy.ends(formatClock(snapshot.deadline, at), formatLeft(snapshot.deadline, at)),
        ];
        paintTimes();
        startClock();
        v.commands.setOutput(null);
        v.commands.setJobs(snapshot.jobs, now);
        runningSeqs = snapshot.jobs
            .filter((j) => j.state === "running")
            .map((j) => j.seq)
            .sort((a, b) => b - a);
        if (streamsRest) streamsRest = false;
        else live ??= startLive();
        wantLive();
        askIn(RUNNING_EVERY_MS);
    }

    function showEnded(record: SessionRecord): void {
        if (mode === "running") stopLive();
        const now = serverNow();
        // Set before any drawing, so the catch in applySafely still knows whether to ask again
        saving = record.output === "pending";
        const unsettled = settlingCalls(record.events) > 0 || allowanceOpen(record.events);
        settlingUntil = unsettled ? record.endedAt.getTime() + SETTLING_FOR_MS : null;
        const v = enter("ended", record);
        status = { text: copy.ended(record.endedBecause), running: false };
        paintStatus();
        timesAt = (at) => [
            copy.started(formatClock(record.startedAt, at)),
            copy.endedAt(formatClock(record.endedAt, at)),
            copy.deletes(formatClock(record.deletesAt, at), formatLeft(record.deletesAt, at)),
        ];
        paintTimes();
        startClock();
        v.commands.setOutput(record.output);
        v.commands.setJobs(record.jobs, now);
        askIn(nextAsk());
    }

    root.replaceChildren(head.root);
    void ask();

    return {
        destroy() {
            destroyed = true;
            stop();
            teardown();
        },
    };
}
