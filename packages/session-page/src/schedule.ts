export interface Scheduler {
    frame(cb: () => void): void;
}

/**
 * Runs queued callbacks once per animation frame. While the tab is hidden nothing runs, so a
 * background tab does not burn CPU rendering a stream nobody sees; the queue flushes on return.
 */
export function createScheduler(doc: Document, win: Window): Scheduler {
    let queue: (() => void)[] = [];
    let requested = false;

    const run = (): void => {
        requested = false;
        if (doc.hidden) return;
        const batch = queue;
        queue = [];
        for (const cb of batch) cb();
    };

    const request = (): void => {
        if (requested || doc.hidden || queue.length === 0) return;
        requested = true;
        win.requestAnimationFrame(run);
    };

    const sync = (): void => {
        doc.documentElement.classList.toggle("is-hidden-tab", doc.hidden);
        request();
    };
    doc.addEventListener("visibilitychange", sync);
    sync();

    return {
        frame(cb) {
            queue.push(cb);
            request();
        },
    };
}
