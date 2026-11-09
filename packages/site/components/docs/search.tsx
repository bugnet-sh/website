"use client";

import { Search as SearchMark } from "lucide-react";
import {
    useEffect,
    useId,
    useRef,
    useState,
    useSyncExternalStore,
    type KeyboardEvent,
} from "react";
import { flushSync } from "react-dom";
import { cx } from "../../lib/cx";
import { entryHref, search, type SearchEntry } from "../../lib/content/search";

const never = () => () => undefined;

/** Whether this is an Apple keyboard, so the hint reads ⌘K; unknown while the server renders. */
function useApple(): boolean | undefined {
    return useSyncExternalStore(
        never,
        () => /Mac|iPhone|iPad/.test(navigator.userAgent),
        () => undefined,
    );
}

/** Typing in a field must not trigger the `/` shortcut. */
function isTyping(target: EventTarget | null): boolean {
    return (
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    );
}

/**
 * The docs search box: a combobox over the build-time index, fetched on first focus. `/` and
 * ⌘K or Ctrl+K focus it; `onReveal` first unfolds whatever hides it.
 */
export function Search({ onReveal }: { onReveal?: () => void }) {
    const listId = useId();
    const input = useRef<HTMLInputElement>(null);
    const root = useRef<HTMLDivElement>(null);
    const [index, setIndex] = useState<SearchEntry[]>();
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const results = index ? search(index, query) : [];
    const shown = open && query.trim() !== "" && index !== undefined;
    const apple = useApple();

    function load() {
        if (index) return;
        fetch("/search-index.json")
            .then((response) => response.json() as Promise<SearchEntry[]>)
            .then(setIndex)
            .catch(() => setIndex([]));
    }

    useEffect(() => {
        function onKeyDown(event: globalThis.KeyboardEvent) {
            const command = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
            const slash = event.key === "/" && !isTyping(event.target);
            if (!command && !slash) return;
            event.preventDefault();
            // The box may sit in a folded menu, which must be shown before it can take focus
            if (onReveal) flushSync(onReveal);
            input.current?.focus();
            input.current?.select();
        }
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [onReveal]);

    useEffect(() => {
        if (!open) return;
        function onPointerDown(event: PointerEvent) {
            if (!root.current?.contains(event.target as Node)) setOpen(false);
        }
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [open]);

    function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === "Escape") {
            setOpen(false);
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!results.length) return;
            setOpen(true);
            const step = event.key === "ArrowDown" ? 1 : -1;
            setActive((at) => (at + step + results.length) % results.length);
        } else if (event.key === "Enter") {
            const chosen = shown ? results[active] : undefined;
            if (!chosen) return;
            event.preventDefault();
            setOpen(false);
            window.location.assign(entryHref(chosen));
        }
    }

    return (
        <div ref={root} role="search" className="relative">
            <SearchMark
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-(--space-3) block size-(--search-icon) -translate-y-1/2 text-text-muted"
            />
            <input
                ref={input}
                type="text"
                role="combobox"
                aria-label="Search the docs"
                aria-expanded={shown}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={shown && results.length ? `${listId}-${active}` : undefined}
                aria-keyshortcuts="Meta+K Control+K /"
                placeholder="Search"
                autoComplete="off"
                spellCheck={false}
                value={query}
                onFocus={() => {
                    load();
                    setOpen(true);
                }}
                onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                    setOpen(true);
                }}
                onKeyDown={onKeyDown}
                className="block h-(--hit) w-full border-(length:--hairline) border-line bg-bg pr-(--space-3) pl-[calc(var(--space-3)+var(--search-icon)+var(--space-2))] text-(length:--ui-size) leading-(--ui-line) text-text placeholder:text-text-muted"
            />
            {/* The shortcut, for a keyboard: touch screens and a typed query hide it */}
            {apple !== undefined && query === "" && (
                <kbd
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 right-(--space-2) grid h-(--kbd) -translate-y-1/2 place-items-center border-(length:--hairline) border-line bg-surface px-(--space-1) font-ui text-(length:--fine-size) leading-(--fine-line) text-text-muted pointer-coarse:hidden"
                >
                    {apple ? "⌘K" : "Ctrl K"}
                </kbd>
            )}
            <ul
                id={listId}
                role="listbox"
                aria-label="Results"
                hidden={!shown}
                className="absolute inset-x-0 top-full z-20 mt-(--space-1) border-(length:--hairline) border-line bg-surface"
            >
                {results.map((entry, i) => (
                    <li
                        key={entryHref(entry)}
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={i === active}
                        onPointerEnter={() => setActive(i)}
                        className="group"
                    >
                        {/* Out of the tab order: the box's arrow keys move through the results */}
                        <a
                            href={entryHref(entry)}
                            tabIndex={-1}
                            onClick={() => setOpen(false)}
                            className={cx(
                                "block px-(--space-3) py-(--space-2) group-aria-selected:bg-surface-hover",
                                i > 0 && "border-t-(length:--hairline) border-line",
                            )}
                        >
                            <span className="block text-(length:--ui-size) leading-(--ui-line) text-text">
                                {entry.heading}
                            </span>
                            {entry.heading !== entry.title && (
                                <span className="block text-(length:--fine-size) leading-(--fine-line) text-text-muted">
                                    {entry.section
                                        ? `${entry.title}: ${entry.section}`
                                        : entry.title}
                                </span>
                            )}
                        </a>
                    </li>
                ))}
                {results.length === 0 && (
                    <li
                        role="option"
                        aria-selected={false}
                        aria-disabled
                        className="px-(--space-3) py-(--space-2) text-(length:--ui-size) leading-(--ui-line) text-text-muted"
                    >
                        No results
                    </li>
                )}
            </ul>
        </div>
    );
}
