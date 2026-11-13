import type { MouseEvent, Ref } from "react";
import { cx } from "../../lib/cx";
import type { Count, Filters } from "../../lib/cloud/servers";
import { SearchIcon, TickIcon } from "../icons";
import { Skeleton } from "../ui/skeleton";

const caps =
    "text-(length:--fine-size) leading-(--fine-line) tracking-(--caps-tracking) text-text-muted uppercase";

/** Adds the id when it is missing and takes it out when it is there */
const toggle = (list: readonly string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

/**
 * A tick box per choice, with how many servers it has. The box is drawn from tokens; the panel
 * scrolls, so a row marks keyboard focus with a ring inside itself, and the box draws none. A row
 * reaches into the panel's padding, so its box and count line up with the search field.
 */
function Choices({
    legend,
    counts,
    chosen,
    onChange,
    mono = false,
    waiting,
}: {
    legend: string;
    counts: readonly Count[];
    chosen: readonly string[];
    onChange: (next: string[]) => void;
    mono?: boolean;
    waiting?: { rows: number; still: boolean };
}) {
    return (
        <fieldset>
            <legend className={caps}>{legend}</legend>
            {waiting && (
                <ul
                    aria-hidden="true"
                    className={cx("mt-(--space-2)", waiting.still && "invisible")}
                >
                    {Array.from({ length: waiting.rows }, (_, i) => (
                        <li key={i} className="flex min-h-(--nav-row) items-center gap-(--space-3)">
                            <Skeleton className="size-(--check) shrink-0" still={waiting.still} />
                            <Skeleton line="ui" className="w-1/3" still={waiting.still} />
                        </li>
                    ))}
                </ul>
            )}
            <ul className={cx("mt-(--space-2)", waiting && "hidden")}>
                {counts.map((c) => (
                    <li key={c.id}>
                        <label className="-mx-(--space-2) flex min-h-(--nav-row) cursor-pointer items-center gap-(--space-3) px-(--space-2) text-(length:--ui-size) leading-(--ui-line) text-text-muted hover:text-text has-checked:text-text has-focus-visible:outline-(length:--ring) has-focus-visible:-outline-offset-(--ring) has-focus-visible:outline-accent has-focus-visible:outline-solid">
                            <span className="relative grid size-(--check) shrink-0 place-items-center">
                                <input
                                    type="checkbox"
                                    checked={chosen.includes(c.id)}
                                    onChange={() => onChange(toggle(chosen, c.id))}
                                    className="peer absolute inset-0 m-0 cursor-pointer appearance-none border-(length:--hairline) border-text-muted bg-bg checked:border-accent checked:bg-accent focus-visible:outline-none"
                                />
                                <TickIcon className="pointer-events-none relative hidden text-accent-ink peer-checked:block" />
                            </span>
                            <span className={cx("min-w-0 flex-1", mono && "font-mono")}>
                                {c.label}
                            </span>{" "}
                            <span className="font-mono text-(length:--fine-size) leading-(--fine-line) text-text-muted">
                                {c.count}{" "}
                                <span className="sr-only">
                                    {c.count === 1 ? "server" : "servers"}
                                </span>
                            </span>
                        </label>
                    </li>
                ))}
            </ul>
        </fieldset>
    );
}

function ClearAll({
    onClick,
    className,
}: {
    onClick: (e: MouseEvent) => void;
    className?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cx(
                "relative h-(--button) items-center text-(length:--ui-size) leading-(--ui-line) text-text-muted before:absolute before:inset-x-0 before:-inset-y-[calc((var(--hit)-var(--button))/2)] before:content-[''] hover:text-text",
                className,
            )}
        >
            Clear all
        </button>
    );
}

/** Search, then a tick box per provider and per package */
export function FilterPanel({
    filters,
    onChange,
    onClear,
    searchRef,
    providers,
    packages,
    active,
    waiting,
}: {
    filters: Filters;
    onChange: (next: Filters) => void;
    onClear: (e: MouseEvent) => void;
    searchRef: Ref<HTMLInputElement>;
    providers: readonly Count[];
    packages: readonly Count[];
    active: number;
    /** Set until the feed answers: the choices pulse as bars, and keep their room once it is off */
    waiting?: { still: boolean };
}) {
    return (
        <div className="flex flex-col gap-(--space-5)">
            {/* Narrow screens name the panel on the button that opens it */}
            <div className="flex h-(--button) items-center justify-between gap-(--space-3) narrow:hidden">
                <h2 className="text-(length:--ui-size) leading-(--ui-line) font-semibold">
                    Filters
                </h2>
                {/* Kept in the row while hidden, so it showing moves nothing */}
                <ClearAll onClick={onClear} className={cx(active === 0 && "invisible")} />
            </div>
            <div role="search" className="relative">
                <SearchIcon />
                <input
                    ref={searchRef}
                    type="text"
                    aria-label="Search servers"
                    placeholder="Search"
                    autoComplete="off"
                    spellCheck={false}
                    value={filters.query}
                    onChange={(e) => onChange({ ...filters, query: e.target.value })}
                    className="block h-(--hit) w-full border-(length:--hairline) border-line bg-bg pr-(--space-3) pl-[calc(var(--space-3)+var(--search-icon)+var(--space-2))] text-(length:--ui-size) leading-(--ui-line) text-text placeholder:text-text-muted"
                />
            </div>
            {/* Side by side while the panel is as wide as the list */}
            <div className="grid gap-(--space-5) narrow:grid-cols-2 narrow:gap-x-(--space-7) phone:grid-cols-1">
                <Choices
                    legend="Provider"
                    counts={providers}
                    chosen={filters.providers}
                    onChange={(next) => onChange({ ...filters, providers: next })}
                    waiting={waiting && { rows: 3, still: waiting.still }}
                />
                <Choices
                    legend="Package"
                    counts={packages}
                    chosen={filters.packages}
                    onChange={(next) => onChange({ ...filters, packages: next })}
                    mono
                    waiting={waiting && { rows: 4, still: waiting.still }}
                />
            </div>
            {/* Under the choices on narrow screens, in reading order, only while one is set */}
            {active > 0 && <ClearAll onClick={onClear} className="hidden self-start narrow:flex" />}
        </div>
    );
}
