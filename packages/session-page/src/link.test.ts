import { describe, expect, it, vi } from "vitest";
import { ID_RE, KEY_RE, readLink, sessionKeyStore, type KeyStore } from "./link.ts";

const id = "abcdefghijklmnop";
const key = `bnk_${"A".repeat(20)}-_${"z9".repeat(10)}x`;
const otherKey = `bnk_${"Q".repeat(43)}`;

function memoryStorage(): Storage {
    const items = new Map<string, string>();
    return {
        get length() {
            return items.size;
        },
        clear: () => items.clear(),
        getItem: (k) => items.get(k) ?? null,
        key: (i) => [...items.keys()][i] ?? null,
        removeItem: (k) => void items.delete(k),
        setItem: (k, v) => void items.set(k, String(v)),
    };
}

function throwingStorage(): Storage {
    const fail = () => {
        throw new DOMException("denied", "SecurityError");
    };
    return {
        get length() {
            return fail();
        },
        clear: fail,
        getItem: fail,
        key: fail,
        removeItem: fail,
        setItem: fail,
    };
}

function open(pathname: string, hash: string, store: KeyStore = sessionKeyStore(memoryStorage())) {
    const replacePath = vi.fn<(path: string) => void>();
    return { state: readLink({ pathname, hash }, store, replacePath), replacePath, store };
}

describe("the shapes", () => {
    it("match the id and key the router makes", () => {
        expect(ID_RE.test(id)).toBe(true);
        expect(ID_RE.test("abcdefghijklmno1")).toBe(false);
        expect(KEY_RE.test(key)).toBe(true);
        expect(KEY_RE.test(`${key}x`)).toBe(false);
        expect(KEY_RE.test(key.replace("bnk_", "bnx_"))).toBe(false);
    });
});

describe("readLink", () => {
    it("takes the key from the fragment, keeps it, and takes it out of the address", () => {
        const { state, replacePath, store } = open(`/s/${id}`, `#k=${key}`);
        expect(state).toEqual({ kind: "ok", id, key });
        expect(store.get(id)).toBe(key);
        expect(replacePath).toHaveBeenCalledExactlyOnceWith(`/s/${id}`);
    });

    it("finds k anywhere in the fragment", () => {
        expect(open(`/s/${id}`, `#x=1&k=${key}`).state).toEqual({ kind: "ok", id, key });
        expect(open(`/s/${id}`, `#k=${key}&x=1`).state).toEqual({ kind: "ok", id, key });
    });

    it("prefers a fresh key from the fragment over a stored one", () => {
        const store = sessionKeyStore(memoryStorage());
        store.set(id, otherKey);
        expect(open(`/s/${id}`, `#k=${key}`, store).state).toEqual({ kind: "ok", id, key });
        expect(store.get(id)).toBe(key);
    });

    it("falls back to the stored key when the fragment has no valid one", () => {
        for (const hash of ["#k=bnk_short", "#", "", "#k=", `#K=${key}`]) {
            const store = sessionKeyStore(memoryStorage());
            store.set(id, key);
            const { state, replacePath } = open(`/s/${id}`, hash, store);
            expect(state, hash).toEqual({ kind: "ok", id, key });
            expect(replacePath.mock.calls, hash).toEqual(hash === "" ? [] : [[`/s/${id}`]]);
        }
    });

    it("says no-key when neither the fragment nor the store has one", () => {
        for (const hash of ["#k=bnk_short", "#", ""]) {
            const { state, replacePath } = open(`/s/${id}`, hash);
            expect(state, hash).toEqual({ kind: "no-key", id });
            expect(replacePath.mock.calls, hash).toEqual(hash === "" ? [] : [[`/s/${id}`]]);
        }
    });

    it("never hands out a key stored for another id", () => {
        const store = sessionKeyStore(memoryStorage());
        store.set("ponmlkjihgfedcba", key);
        expect(open(`/s/${id}`, "", store).state).toEqual({ kind: "no-key", id });
    });

    it("refuses paths that are not a session link", () => {
        for (const pathname of [
            "/s/ABCDEFGHIJKLMNOP",
            "/s/abc",
            `/s/${id}/`,
            `/x/${id}`,
            `/s/${id}x`,
            "/",
        ]) {
            const { state, replacePath } = open(pathname, `#k=${key}`);
            expect(state, pathname).toEqual({ kind: "not-a-link" });
            expect(replacePath, pathname).not.toHaveBeenCalled();
        }
    });

    it("still reads the fragment when storage throws on every call", () => {
        const { state, replacePath, store } = open(
            `/s/${id}`,
            `#k=${key}`,
            sessionKeyStore(throwingStorage()),
        );
        expect(state).toEqual({ kind: "ok", id, key });
        expect(replacePath).toHaveBeenCalledWith(`/s/${id}`);
        expect(store.get(id)).toBeNull();
        expect(() => store.clear(id)).not.toThrow();
    });

    it("works with no storage at all", () => {
        const store = sessionKeyStore(null);
        expect(open(`/s/${id}`, `#k=${key}`, store).state).toEqual({ kind: "ok", id, key });
        expect(open(`/s/${id}`, "", store).state).toEqual({ kind: "no-key", id });
    });
});

describe("sessionKeyStore", () => {
    it("keeps one key per id under bugnet.session.<id>", () => {
        const storage = memoryStorage();
        const store = sessionKeyStore(storage);
        store.set(id, key);
        expect(storage.getItem(`bugnet.session.${id}`)).toBe(key);
        expect(store.get(id)).toBe(key);
        store.clear(id);
        expect(store.get(id)).toBeNull();
        expect(storage.length).toBe(0);
    });

    it("ignores a stored value that is not a key", () => {
        const storage = memoryStorage();
        storage.setItem(`bugnet.session.${id}`, "bnk_short");
        expect(sessionKeyStore(storage).get(id)).toBeNull();
    });
});
