import { cx } from "../../lib/cx";
import { noFilters, type Count, type Filters } from "../../lib/cloud/servers";
import { SearchIcon, TickIcon } from "../icons";

const caps =
    "text-(length:--fine-size) leading-(--fine-line) tracking-(--caps-tracking) text-text-muted uppercase";

/** Adds the id when it is missing and takes it out when it is there */
const toggle = (list: readonly string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

/**
 * A tick box per choice, with how many servers it has. The box is drawn from tokens; the panel
 * scrolls, so a row marks keyboard focus with a ring inside itself.
 */
function Choices({
    legend,
    counts,
    chosen,
    onChange,
    mono = false,
}: {
    legend: string;
    counts: readonly Count[];
    chosen: readonly string[];
    onChange: (next: string[]) => void;
    mono?: boolean;
}) {
    return (
        <fieldset>
            <legend className={caps}>{legend}</legend>
            <ul className="mt-(--space-2)">
                {counts.map((c) => (
                    <li key={c.id}>
                        <label className="flex min-h-(--nav-row) cursor-pointer items-center gap-(--space-3) px-(--space-1) text-(length:--ui-size) leading-(--ui-line) text-text-muted hover:text-text has-checked:text-text has-focus-visible:outline-(length:--ring) has-focus-visible:-outline-offset-(--ring) has-focus-visible:outline-accent has-focus-visible:outline-solid">
                            <span className="relative grid size-(--check) shrink-0 place-items-center">
                                <input
                                    type="checkbox"
                                    checked={chosen.includes(c.id)}
                                    onChange={() => onChange(toggle(chosen, c.id))}
                                    className="peer absolute inset-0 m-0 cursor-pointer appearance-none border-(length:--hairline) border-line bg-bg checked:border-accent checked:bg-accent"
                                />
                                <TickIcon className="pointer-events-none relative hidden text-accent-ink peer-checked:block" />
                            </span>
                            <span className={cx("min-w-0 flex-1", mono && "font-mono")}>
                                {c.label}
                            </span>{" "}
                            <span className="font-mono text-(length:--fine-size) leading-(--fine-line) text-text-muted">
                                {c.count}
                            </span>
                        </label>
                    </li>
                ))}
            </ul>
        </fieldset>
    );
}

function ClearAll({ onClick, className }: { onClick: () => void; className?: string }) {
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
    providers,
    packages,
    active,
}: {
    filters: Filters;
    onChange: (next: Filters) => void;
    providers: readonly Count[];
    packages: readonly Count[];
    active: number;
}) {
    const clear = () => onChange(noFilters);
    return (
        <div className="flex flex-col gap-(--space-5)">
            {/* Narrow screens name the panel on the button that opens it */}
            <div className="flex h-(--button) items-center justify-between gap-(--space-3) narrow:hidden">
                <h2 className="text-(length:--ui-size) leading-(--ui-line) font-semibold">
                    Filters
                </h2>
                {/* Kept in the row while hidden, so it showing moves nothing */}
                <ClearAll onClick={clear} className={cx(active === 0 && "invisible")} />
            </div>
            <div role="search" className="relative">
                <SearchIcon />
                <input
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
                />
                <Choices
                    legend="Package"
                    counts={packages}
                    chosen={filters.packages}
                    onChange={(next) => onChange({ ...filters, packages: next })}
                    mono
                />
            </div>
            {/* Under the choices on narrow screens, in reading order, only while one is set */}
            {active > 0 && <ClearAll onClick={clear} className="hidden self-start narrow:flex" />}
        </div>
    );
}
