export const ID_RE = /^[a-z2-7]{16}$/;
export const KEY_RE = /^bnk_[A-Za-z0-9_-]{43}$/;

const PATH_RE = /^\/s\/([a-z2-7]{16})$/;

export interface KeyStore {
    get(id: string): string | null;
    set(id: string, key: string): void;
    clear(id: string): void;
}

// Private windows and blocked site data make storage throw, and the page must still open
export function sessionKeyStore(storage: Storage | null): KeyStore {
    const name = (id: string) => `bugnet.session.${id}`;
    return {
        get(id) {
            try {
                const key = storage?.getItem(name(id)) ?? null;
                return key !== null && KEY_RE.test(key) ? key : null;
            } catch {
                return null;
            }
        },
        set(id, key) {
            try {
                storage?.setItem(name(id), key);
            } catch {
                // The key still works for this view, only a reload loses it
            }
        },
        clear(id) {
            try {
                storage?.removeItem(name(id));
            } catch {
                // Nothing was stored to clear
            }
        },
    };
}

export type LinkState =
    | { kind: "ok"; id: string; key: string }
    | { kind: "no-key"; id: string }
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
    return key === null ? { kind: "no-key", id } : { kind: "ok", id, key };
}
