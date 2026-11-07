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
    cell: (row: T) => ReactNode;
    numeric?: boolean;
    /** Shown on the one line a phone folds the row to. */
    fold?: boolean;
    /** The folded line's cell that gives way, cut with an ellipsis, when the line is full. */
    grow?: boolean;
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

function FoldRow<T>({ row, fold, rest }: { row: T; fold: Column<T>[]; rest: Column<T>[] }) {
    const [open, setOpen] = useState(false);
    return (
        <li className="border-b-(length:--hairline) border-line">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className="flex h-(--row) w-full cursor-pointer items-center gap-(--space-3) text-left whitespace-nowrap"
            >
                {fold.map((column) => (
                    <span
                        key={column.label}
                        className={column.grow ? "min-w-0 flex-1 truncate" : "shrink-0"}
                    >
                        {column.cell(row)}
                    </span>
                ))}
            </button>
            {open && (
                <dl className="grid gap-(--space-2) pb-(--space-3) text-(length:--fine-size) leading-(--fine-line)">
                    {rest.map((column) => (
                        <div
                            key={column.label}
                            className="flex min-w-0 items-center gap-(--space-2)"
                        >
                            <dt className="shrink-0 text-text-muted">{column.label}:</dt>
                            <dd className="min-w-0 truncate">{column.cell(row)}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </li>
    );
}

/**
 * A band holding a table fed 50 rows at a time. It keeps a fixed height and scrolls inside it
 * under a sticky header, so a page of rows arriving moves nothing below. On phones each row folds
 * to one line that opens the rest.
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

    return (
        <Band>
            <div className="py-(--space-6)">
                <h2 className="text-(length:--ui-size) leading-(--ui-line) font-semibold">
                    {title}
                </h2>
                <div className="relative mt-(--space-4) h-(--table) border-b-(length:--hairline) border-line text-(length:--ui-size) leading-(--ui-line)">
                    {phase === "ready" && (
                        <>
                            <div className="h-full overflow-auto phone:hidden">
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
                                                        {column.cell(row)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <ul className="hidden h-full overflow-y-auto phone:block">
                                {rows.map((row, i) => (
                                    <FoldRow key={i} row={row} fold={fold} rest={rest} />
                                ))}
                            </ul>
                        </>
                    )}
                    {phase === "failed" && (
                        <Unavailable text={`${noun} are unavailable right now.`} />
                    )}
                    {phase === "ready" && rows.length === 0 && <Unavailable text={empty} />}
                </div>
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
