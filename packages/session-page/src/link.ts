export const ID_RE = /^[a-z2-7]{16}$/;
export const KEY_RE = /^bnk_[A-Za-z0-9_-]{43}$/;

const PATH_RE = /^\/s\/([a-z2-7]{16})$/;

// How a page ended for good, kept so a reload says so rather than ask for the full link again
export type Gone = "deleted" | "expired" | "not-found";

const GONE: readonly Gone[] = ["deleted", "expired", "not-found"];
const GONE_PREFIX = "gone:";

export interface KeyStore {
    get(id: string): string | null;
    set(id: string, key: string): void;
    // Replaces the key, which KEY_RE never matches, so no key is kept
    markGone(id: string, why: Gone): void;
    gone(id: string): Gone | null;
}

// Private windows and blocked site data make storage throw, and the page must still open
export function sessionKeyStore(storage: Storage | null): KeyStore {
    const name = (id: string) => `bugnet.session.${id}`;
    const read = (id: string): string | null => {
        try {
            return storage?.getItem(name(id)) ?? null;
        } catch {
            return null;
        }
    };
    const write = (id: string, value: string) => {
        try {
            storage?.setItem(name(id), value);
        } catch {
            // What was written still holds for this view, only a reload loses it
        }
    };
    return {
        get(id) {
            const key = read(id);
            return key !== null && KEY_RE.test(key) ? key : null;
        },
        set: write,
        markGone(id, why) {
            write(id, `${GONE_PREFIX}${why}`);
        },
        gone(id) {
            const value = read(id);
            if (value === null || !value.startsWith(GONE_PREFIX)) return null;
            const why = value.slice(GONE_PREFIX.length);
            return GONE.find((g) => g === why) ?? null;
        },
    };
}

export type LinkState =
    | { kind: "ok"; id: string; key: string }
    | { kind: "no-key"; id: string }
    | { kind: "gone"; id: string; why: Gone }
    | { kind: "not-a-link" };

function keyFromFragment(hash: string): string | null {
    for (const part of hash.replace(/^#/, "").split("&")) {
        const eq = part.indexOf("=");
        if (eq < 0 || part.slice(0, eq) !== "k") continue;
        const value = part.slice(eq + 1);
        if (KEY_RE.test(value)) return value;
    }
    return null;
}

export function readLink(
    loc: { pathname: string; hash: string },
    store: KeyStore,
    replacePath: (path: string) => void,
): LinkState {
    const id = PATH_RE.exec(loc.pathname)?.[1];
    if (id === undefined) return { kind: "not-a-link" };
    const fromFragment = keyFromFragment(loc.hash);
    if (fromFragment !== null) store.set(id, fromFragment);
    // Screen shares and copied addresses would otherwise show the key
    if (loc.hash !== "") replacePath(`/s/${id}`);
    const key = fromFragment ?? store.get(id);
    if (key !== null) return { kind: "ok", id, key };
    const why = store.gone(id);
    return why === null ? { kind: "no-key", id } : { kind: "gone", id, why };
}
