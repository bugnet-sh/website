"use client";

import { fetchPage } from "../../lib/stats/client";
import { formatDuration } from "../../lib/stats/format";
import { formatStamp, providerLabel, sizeText, statusText } from "../../lib/stats/labels";
import type { SessionRow } from "../../lib/stats/types";
import { formatCount } from "../../lib/stats/view";
import { Cut, TxLink, Usdc, WalletCell } from "./cells";
import { PagedTable, type Column, type Load } from "./paged-table";

function Ended({ row }: { row: SessionRow }) {
    if (row.status === "running") {
        return (
            <span className="inline-flex items-center gap-(--space-2)">
                {/* The page's only motion, stilled for readers who ask for less */}
                <span
                    aria-hidden
                    className="size-(--dot) shrink-0 animate-pulse rounded-full bg-text motion-reduce:animate-none"
                />
                Running
            </span>
        );
    }
    return row.endedAt === null ? null : formatStamp(row.endedAt);
}

function Status({ row }: { row: SessionRow }) {
    const { text, bad } = statusText(row);
    return <span className={bad ? "text-bad" : "text-text"}>{text}</span>;
}

const columns: Column<SessionRow>[] = [
    { label: "Ended", cell: (row) => <Ended row={row} />, fold: true },
    {
        label: "Provider",
        // Null when the session never started
        cell: (row) => row.provider !== null && <Cut>{providerLabel(row.provider)}</Cut>,
        fold: true,
    },
    { label: "Size", cell: sizeText },
    { label: "Duration", cell: (row) => formatDuration(row.seconds), numeric: true },
    { label: "Commands", cell: (row) => formatCount(row.commands), numeric: true },
    { label: "Price", cell: (row) => <Usdc micros={row.priceMicros} />, numeric: true, fold: true },
    {
        label: "Status",
        cell: (row) => <Status row={row} />,
        // Ended already reads "Running" on the folded line, so it is not said twice
        foldCell: (row) => row.status !== "running" && <Status row={row} />,
        fold: true,
        // The reason is the folded line's longest text, so it gives way before the provider
        grow: true,
    },
    {
        label: "Wallet",
        cell: (row) => <WalletCell wallet={row.wallet} />,
        filled: (row) => row.wallet !== null,
    },
    { label: "Tx", cell: (row) => <TxLink tx={row.tx} />, filled: (row) => row.tx !== null },
];

const loadSessions: Load<SessionRow> = (before) => fetchPage("sessions", before);

/** Band 7: sessions of the last 30 days, newest first. */
export function SessionsTable({ load = loadSessions }: { load?: Load<SessionRow> }) {
    return (
        <PagedTable
            title="Past sessions"
            noun="Sessions"
            empty="No sessions in the last 30 days."
            columns={columns}
            load={load}
        />
    );
}
