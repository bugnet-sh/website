"use client";

import { useId, useRef, useState, type MouseEvent } from "react";
import {
    activeFilters,
    cloudServers,
    filterServers,
    noFilters,
    packageCounts,
    providerCounts,
    sortKeys,
    sortServers,
    type Filters,
    type SortKey,
} from "../../lib/cloud/servers";
import { cx } from "../../lib/cx";
import { catalogPackages } from "../../lib/landing/catalog";
import { ChevronIcon } from "../icons";
import { Band, Frame } from "../shell/frame";
import { useStats } from "../stats/stats-provider";
import { secondaryButton } from "../ui/button";
import { FilterPanel } from "./filter-panel";
import { liveOf } from "./live";
import { ServerCard } from "./server-card";

/** The Sort control: a native select, drawn square from tokens, with the Docs menu's chevron */
function SortSelect({ value, onChange }: { value: SortKey; onChange: (key: SortKey) => void }) {
    const id = useId();
    return (
        <div className="flex items-center gap-(--space-2)">
            <label
                htmlFor={id}
                className="text-(length:--ui-size) leading-(--ui-line) text-text-muted"
            >
                Sort
            </label>
            <div className="relative">
                <select
                    id={id}
                    value={value}
                    onChange={(e) => onChange(e.target.value as SortKey)}
                    className="block h-(--button) cursor-pointer appearance-none border-(length:--hairline) border-line bg-bg pr-[calc(var(--space-3)+var(--chevron)+var(--space-2))] pl-(--space-3) text-(length:--ui-size) leading-(--ui-line) text-text"
                >
                    {sortKeys.map((k) => (
                        <option key={k.value} value={k.value}>
                            {k.label}
                        </option>
                    ))}
                </select>
                <span className="pointer-events-none absolute top-1/2 right-(--space-3) -translate-y-1/2 text-text-muted">
                    <ChevronIcon open={false} />
                </span>
            </div>
        </div>
    );
}

// The rail the filters stick to, under the sticky header, as the docs' On this page list does
const rail =
    "sticky top-[calc(var(--nav)+var(--space-6))] max-h-[calc(100svh-var(--nav)-2*var(--space-6))] self-start";

/**
 * Every server a package can land on, with a filter panel beside the list. The prices come from
 * the live feed's packages when it answers and from the router's catalog copy until then, so the
 * exported page already lists every server. Narrow screens fold the panel behind a button above
 * the list.
 */
export function CloudServers() {
    const stats = useStats();
    const [filters, setFilters] = useState<Filters>(noFilters);
    const [sort, setSort] = useState<SortKey>("price");
    const [open, setOpen] = useState(false);
    const panelId = useId();
    const toggle = useRef<HTMLButtonElement>(null);
    const search = useRef<HTMLInputElement>(null);

    const live = stats.data?.packages ?? [];
    const packages = live.length > 0 ? live : catalogPackages();
    const servers = cloudServers(packages);
    const shown = sortServers(filterServers(servers, filters), sort);
    const active = activeFilters(filters);

    /**
     * A clear takes away the button that was pressed. From the keyboard, a click with no detail,
     * focus goes on to the Filters button, which only narrow screens show, or else to the search.
     */
    const clear = (e: MouseEvent) => {
        setFilters(noFilters);
        if (e.detail !== 0) return;
        toggle.current?.focus();
        if (document.activeElement !== toggle.current) search.current?.focus();
    };

    return (
        <Band rail={false}>
            <Frame className="grid grid-cols-[minmax(0,1fr)_var(--filters)] gap-x-(--space-7) pt-(--space-6) pb-(--band) narrow:grid-cols-1">
                {/* Padded so a focus ring at its edge is not cut; the filter rows reach into the pad */}
                <aside
                    aria-label="Filters"
                    className={cx(
                        rail,
                        "col-start-2 row-start-1 -m-(--space-2) overflow-y-auto scrollbar-hidden p-(--space-2) narrow:static narrow:col-start-1 narrow:max-h-none narrow:overflow-visible",
                    )}
                >
                    <button
                        ref={toggle}
                        type="button"
                        aria-expanded={open}
                        aria-controls={panelId}
                        onClick={() => setOpen((was) => !was)}
                        className="relative hidden h-(--button) w-full items-center justify-between border-(length:--hairline) border-line px-(--space-3) text-(length:--ui-size) leading-(--ui-line) text-text before:absolute before:inset-x-0 before:-inset-y-[calc((var(--hit)-var(--button))/2)] before:content-[''] narrow:flex"
                    >
                        <span className="flex items-center gap-(--space-2)">
                            Filters
                            {active > 0 && (
                                <span className="bg-accent px-(--space-1) font-mono text-(length:--fine-size) leading-(--fine-line) text-accent-ink">
                                    <span className="sr-only">, </span>
                                    {active}
                                    <span className="sr-only"> on</span>
                                </span>
                            )}
                        </span>
                        <ChevronIcon open={open} />
                    </button>
                    <div
                        id={panelId}
                        className={cx(
                            "narrow:mt-(--space-3) narrow:border-(length:--hairline) narrow:border-line narrow:p-(--space-4)",
                            !open && "narrow:hidden",
                        )}
                    >
                        <FilterPanel
                            filters={filters}
                            onChange={setFilters}
                            onClear={clear}
                            searchRef={search}
                            providers={providerCounts(servers)}
                            packages={packageCounts(servers)}
                            active={active}
                        />
                    </div>
                </aside>
                <div className="col-start-1 row-start-1 min-w-0 narrow:row-start-2 narrow:mt-(--space-5)">
                    <div className="flex min-h-(--button) items-center justify-between gap-x-(--space-4) gap-y-(--space-3) phone:flex-col phone:items-start">
                        <p
                            aria-live="polite"
                            aria-atomic="true"
                            className="text-(length:--ui-size) leading-(--ui-line) text-text-muted"
                        >
                            {`Showing ${shown.length} of ${servers.length} servers`}
                        </p>
                        <SortSelect value={sort} onChange={setSort} />
                    </div>
                    {shown.length > 0 ? (
                        // As far below the Sort row as the search field is below Filters
                        <ul className="mt-(--space-5) grid gap-(--space-4)">
                            {shown.map((server) => (
                                <li key={server.id}>
                                    <ServerCard
                                        server={server}
                                        live={liveOf(stats, server.provider.id)}
                                    />
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="mt-(--space-5) flex flex-col items-start gap-(--space-4) border-(length:--hairline) border-line px-(--space-5) py-(--space-6)">
                            <p className="text-(length:--ui-size) leading-(--ui-line) text-text-muted">
                                No server matches.
                            </p>
                            <button type="button" onClick={clear} className={secondaryButton}>
                                Clear filters
                            </button>
                        </div>
                    )}
                </div>
            </Frame>
        </Band>
    );
}
