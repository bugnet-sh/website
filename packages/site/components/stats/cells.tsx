import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { alignedDecimals, formatShortWallet, formatUsdc } from "../../lib/stats/format";
import { ExternalArrow } from "../icons";
import { CopyButton } from "./copy-button";

/**
 * A table's cells line up with the frame's edges: the first and last pad only inward. Narrower
 * screens pad less, so a wide table still fits its frame.
 */
const cellPad = "px-(--space-3) narrow:px-(--space-2) first:pl-0! last:pr-0! whitespace-nowrap";

export const headCell = (numeric = false): string =>
    cx(
        "sticky top-0 z-1 h-(--row) border-b-(length:--hairline) border-line bg-bg text-(length:--fine-size) leading-(--fine-line) font-semibold text-text-muted",
        numeric ? "text-right" : "text-left",
        cellPad,
    );

export const bodyCell = (numeric = false): string =>
    cx(
        "h-(--row) border-b-(length:--hairline) border-line",
        numeric && "text-right font-mono",
        cellPad,
    );

/** Hairline rules, with none under the last row, where the box's own edge draws it. */
export const tableClass =
    "w-full border-separate border-spacing-0 text-(length:--ui-size) leading-(--ui-line) [&_tbody_tr:last-child_td]:border-b-0";

/** Feed strings never wrap mid-token; a long one is cut by CSS, never by the page. */
export function Cut({ children }: { children: ReactNode }) {
    return <span className="block max-w-(--cell-max) truncate">{children}</span>;
}

/**
 * A column's shared precision over its rows, so its decimal points line up (founder decision 26),
 * worked out once for each set of rows.
 */
export function columnDecimals<T>(micros: (row: T) => number): (rows: readonly T[]) => number {
    const seen = new WeakMap<readonly T[], number>();
    return (rows) => {
        let decimals = seen.get(rows);
        if (decimals === undefined) {
            decimals = alignedDecimals(rows.map(micros));
            seen.set(rows, decimals);
        }
        return decimals;
    };
}

/** An amount in USDC: the figure in mono, then the unit, as the headline numbers show it. */
export function Usdc({
    micros,
    outgoing = false,
    decimals,
}: {
    micros: number;
    /** Money going back to a user: a minus sign, and muted rather than the money colour. */
    outgoing?: boolean;
    /** A column's shared precision, from `alignedDecimals`. */
    decimals?: number;
}) {
    return (
        <span className="whitespace-nowrap">
            <span className={cx("font-mono", outgoing ? "text-text-muted" : "text-accent-2")}>
                {outgoing
                    ? `−${formatUsdc(micros, { decimals })}`
                    : formatUsdc(micros, { decimals })}
            </span>
            <span className="ml-(--space-1) font-ui text-(length:--fine-size) text-text-muted">
                USDC
            </span>
        </span>
    );
}

export function WalletCell({ wallet }: { wallet: string | null }) {
    if (wallet === null) return null;
    return (
        <span className="inline-flex items-center gap-(--space-2)">
            <span className="font-mono">{formatShortWallet(wallet)}</span>
            <CopyButton text={wallet} label="Copy wallet address" />
        </span>
    );
}

export function TxLink({ tx }: { tx: string | null }) {
    if (tx === null) return null;
    return (
        <a
            href={`https://solscan.io/tx/${tx}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-(--space-1) text-text hover:text-accent"
        >
            View
            <ExternalArrow />
            <span className="sr-only">(opens in a new tab)</span>
        </a>
    );
}
