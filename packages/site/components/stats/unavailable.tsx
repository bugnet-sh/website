import type { SummaryState } from "../../lib/stats/client";

/** Only once the first fetch has failed: while it is in flight, a box stays empty instead. */
export const isUnavailable = ({ data, failedAt }: SummaryState): boolean =>
    data === null && failedAt !== null;

/**
 * Covers a data box that has nothing to show, centred over it, so the box keeps its fixed height
 * and the data arriving later moves nothing. The box must be positioned.
 */
export function Unavailable({ text = "Stats are unavailable right now." }: { text?: string }) {
    return (
        <div className="absolute inset-0 z-1 flex items-center justify-center bg-bg px-(--pad) text-center text-(length:--ui-size) leading-(--ui-line) text-text-muted">
            {text}
        </div>
    );
}
