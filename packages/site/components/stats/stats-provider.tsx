"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStatsSummary, type SummaryState } from "../../lib/stats/client";
import { defaultRange, type Range } from "../../lib/stats/view";

export type StatsContextValue = SummaryState & {
    /** Shared by the money and usage charts, so one choice sets both. */
    range: Range;
    setRange: (range: Range) => void;
};

const StatsContext = createContext<StatsContextValue | null>(null);

export function useStats(): StatsContextValue {
    const value = useContext(StatsContext);
    if (value === null) throw new Error("useStats must be used inside <StatsProvider />");
    return value;
}

/** Holds a given summary state, so tests can show the page in any state without a feed. */
export function StatsState({ summary, children }: { summary: SummaryState; children: ReactNode }) {
    const [chosen, setRange] = useState<Range | null>(null);
    // Until the reader picks one, the range follows how many days the feed has. Before the feed
    // answers it shows the usual 30 days, so the control does not flip as the data arrives.
    const range = chosen ?? (summary.data ? defaultRange(summary.data.daily.length) : "30d");
    return (
        <StatsContext.Provider value={{ ...summary, range, setRange }}>
            {children}
        </StatsContext.Provider>
    );
}

/** The live summary, refreshed every 30 s, for everything on the stats page. */
export function StatsProvider({ children }: { children: ReactNode }) {
    return <StatsState summary={useStatsSummary()}>{children}</StatsState>;
}
