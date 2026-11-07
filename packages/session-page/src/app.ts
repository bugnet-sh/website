/**
 * The session page: reads the link, shows the gate, and after the click shows whatever the
 * sessions route answers (session-page-ui.md 4).
 *
 * A running session is asked for again every 10 s and its commands stream live. An ended one is
 * asked for again only while its output is being saved. Every answer that reaches a final state
 * (expired, not found, deleted, too new) stops the timers and the streams for good, and answers
 * still in flight from before that are dropped.
 */
import { createApi, type GetResult } from "./api.ts";
import { copy } from "./copy.ts";
import { formatClock, formatLeft } from "./format.ts";
import { readLink, sessionKeyStore } from "./link.ts";
import { createLive, type Live } from "./live.ts";
import type { SessionRecord, Snapshot } from "./payload.ts";
import { createCommandsView, type CommandsView } from "./render/commands.ts";
import type { Clipboard } from "./render/controls.ts";
import {
    createGate,
    createMapSection,
    createSessionHead,
    createSessionMeta,
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
const FAILURES_BEFORE_NOTICE = 3;
// The route's per-IP limit on live streams
const MAX_STREAMS = 4;
const STREAM_RETRY_MS = 2_000;

type Mode = "gate" | "message" | "running" | "ended";

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
        const text = link.kind === "no-key" ? copy.noKey : copy.notALink;
        root.replaceChildren(head.root, messageLine(doc, text));
        return { destroy() {} };
    }

    const { id } = link;
    const api = createApi({ fetch: env.fetch, id, key: link.key });

    let mode: Mode = "gate";
    let view: View | null = null;
    let live: Live | null = null;
    // Seqs whose stream state the commands view shows, reset when the streams stop
    const liveSeqs = new Set<number>();
    let runningSeqs: number[] = [];
    // Bumped on every stop, so an answer to an older ask is dropped
    let epoch = 0;
    let timer: number | null = null;
    let destroyed = false;
    // The server clock minus the viewer's, so a wrong viewer clock never skews time left
    let offsetMs = 0;
    let failures = 0;
    let saving = false;
    let savingAsks = 0;
    let status: { text: string; running: boolean } | null = null;

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

    function askIn(ms: number | null): void {
        clearAsk();
        if (ms === null) return;
        timer = env.setTimer(() => {
            timer = null;
            void ask();
        }, ms);
    }

    function nextAsk(): number | null {
        if (mode === "running") return RUNNING_EVERY_MS;
        if (mode !== "ended" || !saving) return null;
        return savingAsks++ < SAVING_FAST_ASKS ? SAVING_EVERY_MS : SAVING_SLOW_MS;
    }

    async function ask(): Promise<void> {
        const at = epoch;
        const result = await api.get();
        if (destroyed || at !== epoch) return;
        apply(result);
    }

    function apply(result: GetResult): void {
        if (!result.ok) {
            if (result.error === "not-found") finish(copy.notFound, true);
            else if (result.error === "bad-payload") finish(copy.tooNew, false);
            else if (view !== null) failed();
            else offerRetry(result.error === "rate-limited" ? copy.rateLimited : copy.offline);
            return;
        }
        const body = result.body;
        if (body.state === "expired") finish(copy.expired, true);
        else if (body.state === "too-new") finish(copy.tooNew, false);
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
        stopLive();
    }

    function teardown(): void {
        view?.commands.destroy();
        view?.map?.destroy();
        view = null;
    }

    function finish(text: string, forgetKey: boolean): void {
        stop();
        if (forgetKey) store.clear(id);
        teardown();
        mode = "message";
        status = null;
        head.setStatus(null);
        head.setTip(false);
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
            retryButton(doc, () => void ask()),
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
            onGone: () => finish(copy.notFound, true),
            onSessionEnd: () => {
                stop();
                void ask();
            },
            setTimer: (cb, ms) => env.setTimer(cb, ms),
            clearTimer: (t) => env.clearTimer(t as number),
        });
    }

    async function remove(): Promise<boolean> {
        // An ask answered after the delete would show a stale view or a not-found line
        epoch++;
        clearAsk();
        const result = await api.remove();
        if (destroyed) return true;
        if (result.ok) finish(copy.deleted, true);
        else if (result.error === "not-found") finish(copy.notFound, true);
        else {
            askIn(nextAsk());
            return false;
        }
        return true;
    }

    // The heading row, the times and the commands stay across running and ended
    function enter(kind: "running" | "ended", record: SessionRecord | null): View {
        if (view !== null && mode === kind) return view;
        const map =
            record === null
                ? null
                : createMapSection(doc, record, { now: serverNow, clipboard: env.clipboard });
        const middle = map === null ? mapLaterLine(doc) : map.root;
        if (view === null) {
            const commands = createCommandsView({
                doc,
                scheduler: env.scheduler,
                clipboard: env.clipboard,
                now: serverNow,
            });
            commands.onToggle(wantLive);
            commands.root.querySelector("table")?.setAttribute("data-edge", "");
            view = { meta: createSessionMeta(doc, remove), middle, map, commands };
            root.replaceChildren(head.root, view.meta.root, middle, commands.root);
        } else {
            view.map?.destroy();
            view.middle.replaceWith(middle);
            view.middle = middle;
            view.map = map;
        }
        mode = kind;
        head.heading.focus();
        return view;
    }

    function showRunning(snapshot: Snapshot): void {
        offsetMs = snapshot.now.getTime() - env.now().getTime();
        const now = serverNow();
        const v = enter("running", null);
        status = { text: copy.running, running: true };
        paintStatus();
        v.meta.setTimes([
            copy.started(formatClock(snapshot.startedAt, now)),
            copy.ends(formatClock(snapshot.deadline, now), formatLeft(snapshot.deadline, now)),
        ]);
        v.commands.setOutput(null);
        v.commands.setJobs(snapshot.jobs, now);
        runningSeqs = snapshot.jobs
            .filter((j) => j.state === "running")
            .map((j) => j.seq)
            .sort((a, b) => b - a);
        live ??= startLive();
        wantLive();
        askIn(RUNNING_EVERY_MS);
    }

    function showEnded(record: SessionRecord): void {
        const justEnded = mode === "running";
        if (justEnded) stopLive();
        const now = serverNow();
        const v = enter("ended", record);
        status = {
            text: justEnded ? copy.sandboxEnded : copy.ended(record.endedBecause),
            running: false,
        };
        paintStatus();
        v.meta.setTimes([
            copy.started(formatClock(record.startedAt, now)),
            copy.endedAt(formatClock(record.endedAt, now)),
            copy.deletes(formatLeft(record.deletesAt, now)),
        ]);
        v.commands.setOutput(record.output);
        v.commands.setJobs(record.jobs, now);
        saving = record.output === "pending";
        askIn(nextAsk());
    }

    head.setTip(true);
    root.replaceChildren(
        head.root,
        createGate(doc, () => void ask()),
    );

    return {
        destroy() {
            destroyed = true;
            stop();
            teardown();
        },
    };
}
