"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import type { Page } from "../../lib/stats/types";
import { Band } from "../shell/frame";
import { bodyCell, headCell, tableClass } from "./cells";
import { Unavailable } from "./unavailable";

export type Load<T> = (before?: string) => Promise<Page<T> | null>;

export type Column<T> = {
    label: string;
    /** `rows` is every loaded row, for a column that lines its amounts up. */
    cell: (row: T, rows: readonly T[]) => ReactNode;
    numeric?: boolean;
    /** Shown on the one line a phone folds the row to. */
    fold?: boolean;
    /** The folded line's cell that gives way, cut with an ellipsis, when the line is full. */
    grow?: boolean;
    /** The cell on the folded line, when it differs from the table's. */
    foldCell?: (row: T, rows: readonly T[]) => ReactNode;
    /** A column no loaded row fills is left out (founder decision 25). */
    filled?: (row: T) => boolean;
};

type Phase = "loading" | "ready" | "failed";
type More = "idle" | "loading" | "failed";

function usePaged<T>(load: Load<T>) {
    const [rows, setRows] = useState<T[]>([]);
    const [next, setNext] = useState<string | null>(null);
    const [phase, setPhase] = useState<Phase>("loading");
    const [more, setMore] = useState<More>("idle");

    useEffect(() => {
        let alive = true;
        void load().then((page) => {
            if (!alive) return;
            if (page === null) return setPhase("failed");
            setRows(page.items);
            setNext(page.next);
            setPhase("ready");
        });
        return () => {
            alive = false;
        };
    }, [load]);

    const showMore = async () => {
        if (next === null || more === "loading") return;
        setMore("loading");
        const page = await load(next);
        if (page === null) return setMore("failed");
        setRows((rows) => [...rows, ...page.items]);
        setNext(page.next);
        setMore("idle");
    };

    return { rows, next, phase, more, showMore };
}

/**
 * One folded row. The rows share the list's columns, as a table's rows do, so a short provider
 * or status never moves the price beside it.
 */
function FoldRow<T>({
    row,
    rows,
    fold,
    rest,
}: {
    row: T;
    rows: readonly T[];
    fold: Column<T>[];
    rest: Column<T>[];
}) {
    const [open, setOpen] = useState(false);
    return (
        <li className="col-span-full grid grid-cols-subgrid border-b-(length:--hairline) border-line">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className="col-span-full grid h-(--row) cursor-pointer grid-cols-subgrid items-center text-left whitespace-nowrap"
            >
                {fold.map((column) => (
                    <span
                        key={column.label}
                        className={cx(
                            "min-w-0",
                            column.grow && "truncate",
                            column.numeric && "justify-self-end",
                        )}
                    >
                        {(column.foldCell ?? column.cell)(row, rows)}
                    </span>
                ))}
            </button>
            {open && (
                <dl className="col-span-full grid gap-(--space-2) pb-(--space-3) text-(length:--fine-size) leading-(--fine-line)">
                    {rest.map((column) => (
                        <div
                            key={column.label}
                            className="flex min-w-0 items-center gap-(--space-2)"
                        >
                            <dt className="shrink-0 text-text-muted">{column.label}:</dt>
                            <dd className="min-w-0 truncate">{column.cell(row, rows)}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </li>
    );
}

/**
 * A band holding a table fed 50 rows at a time. It keeps a fixed height and scrolls inside it
 * under a sticky header, so a page of rows arriving moves nothing below. On tablets and phones each
 * row folds to one line that opens the rest.
 */
export function PagedTable<T>({
    title,
    noun,
    empty,
    columns,
    load,
}: {
    title: string;
    /** Names the rows in the unavailable message: "Sessions". */
    noun: string;
    empty: string;
    columns: Column<T>[];
    load: Load<T>;
}) {
    const { rows, next, phase, more, showMore } = usePaged(load);
    const shown = columns.filter((c) => c.filled === undefined || rows.some(c.filled));
    const fold = shown.filter((c) => c.fold);
    const rest = shown.filter((c) => !c.fold);
    const foldColumns = fold.map((c) => (c.grow ? "minmax(0,1fr)" : "auto")).join(" ");

    return (
        <Band>
            <div className="py-(--space-6)">
                <h2 className="text-(length:--ui-size) leading-(--ui-line) font-semibold">
                    {title}
                </h2>
                <div className="relative mt-(--space-4) h-(--table) border-b-(length:--hairline) border-line text-(length:--ui-size) leading-(--ui-line) tablet:h-(--table-fold)">
                    {phase === "ready" && (
                        <>
                            {/* Relative so the links' sr-only text is clipped here, not by the page */}
                            <div className="relative h-full overflow-auto tablet:hidden">
                                <table className={cx(tableClass, "min-w-(--table-min)")}>
                                    <thead>
                                        <tr>
                                            {shown.map((column) => (
                                                <th
                                                    key={column.label}
                                                    scope="col"
                                                    className={headCell(column.numeric)}
                                                >
                                                    {column.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row, i) => (
                                            // Rows are only ever appended, so a row keeps its index
                                            <tr key={i}>
                                                {shown.map((column) => (
                                                    <td
                                                        key={column.label}
                                                        className={bodyCell(column.numeric)}
                                                    >
                                                        {column.cell(row, rows)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <ul
                                className="hidden h-full content-start gap-x-(--space-3) overflow-y-auto tablet:grid phone:gap-x-(--space-2)"
                                style={{ gridTemplateColumns: foldColumns }}
                            >
                                {rows.map((row, i) => (
                                    <FoldRow
                                        key={i}
                                        row={row}
                                        rows={rows}
                                        fold={fold}
                                        rest={rest}
                                    />
                                ))}
                            </ul>
                        </>
                    )}
                    {phase === "failed" && (
                        <Unavailable text={`${noun} are unavailable right now.`} />
                    )}
                    {phase === "ready" && rows.length === 0 && <Unavailable text={empty} />}
                </div>
                {/* Kept while the first page loads, as most tables have more to show */}
                {phase === "loading" && <div aria-hidden className="h-(--row)" />}
                {phase === "ready" && next !== null && (
                    <button
                        type="button"
                        disabled={more === "loading"}
                        onClick={() => void showMore()}
                        className="h-(--row) w-full cursor-pointer border-b-(length:--hairline) border-line text-(length:--ui-size) leading-(--ui-line) text-text hover:bg-surface-hover disabled:cursor-default disabled:text-text-muted"
                    >
                        {more === "failed" ? "Couldn't load more. Try again." : "Show more"}
                    </button>
                )}
            </div>
        </Band>
    );
}
