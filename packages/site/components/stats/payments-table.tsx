"use client";

import { fetchPage } from "../../lib/stats/client";
import { formatStamp, isOutgoing, listKindLabels, methodLabel } from "../../lib/stats/labels";
import type { PaymentRow } from "../../lib/stats/types";
import { Cut, PagedTable, TxLink, Usdc, WalletCell, type Column, type Load } from "./paged-table";

const columns: Column<PaymentRow>[] = [
    { label: "Time", cell: (row) => formatStamp(row.at), fold: true },
    { label: "What", cell: (row) => listKindLabels[row.kind], fold: true, grow: true },
    {
        label: "Method",
        // Refunds and returns have none
        cell: (row) => row.method !== null && <Cut>{methodLabel(row.method)}</Cut>,
    },
    {
        label: "Amount",
        cell: (row) => <Usdc micros={row.amountMicros} outgoing={isOutgoing(row.kind)} />,
        numeric: true,
        fold: true,
    },
    {
        label: "Wallet",
        cell: (row) => <WalletCell wallet={row.wallet} />,
        filled: (row) => row.wallet !== null,
    },
    { label: "Tx", cell: (row) => <TxLink tx={row.tx} />, filled: (row) => row.tx !== null },
];

const loadPayments: Load<PaymentRow> = (before) => fetchPage("payments", before);

/** Band 8: payments, newest first, in the same table shape as the sessions above. */
export function PaymentsTable({ load = loadPayments }: { load?: Load<PaymentRow> }) {
    return (
        <PagedTable
            title="Past payments"
            noun="Payments"
            empty="No payments yet."
            columns={columns}
            load={load}
        />
    );
}
