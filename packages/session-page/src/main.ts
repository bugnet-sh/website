import { startPage } from "./app.ts";
import { copy } from "./copy.ts";
import { messageLine } from "./render/session.ts";
import { createScheduler } from "./schedule.ts";

// Private windows and blocked site data make even reading sessionStorage throw
function sessionStore(): Storage | null {
    try {
        return window.sessionStorage;
    } catch {
        return null;
    }
}

try {
    startPage({
        doc: document,
        location: window.location,
        replacePath: (path) => history.replaceState(null, "", path),
        storage: sessionStore(),
        fetch: (input, init) => window.fetch(input, init),
        now: () => new Date(),
        // Async, so a missing clipboard rejects and the button says the copy failed
        clipboard: { writeText: async (text) => navigator.clipboard.writeText(text) },
        scheduler: createScheduler(document, window),
        setTimer: (cb, ms) => window.setTimeout(cb, ms),
        clearTimer: (id) => window.clearTimeout(id),
    });
} catch {
    document.getElementById("app")?.replaceChildren(messageLine(document, copy.offline));
}
