"use client";

import { useEffect, useState } from "react";
import { parsePayments, parseSessions, parseSummary } from "./parse";
import type { Page, PaymentRow, SessionRow, StatsSummary } from "./types";

export const REFRESH_MS = 30_000;

// The feed is public and same-origin, so a request carries nothing about the reader
const init: RequestInit = { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" };

async function get<T>(url: string, parse: (json: unknown) => T | null): Promise<T | null> {
    try {
        const res = await fetch(url, init);
        if (!res.ok) return null;
        return parse(await res.json());
    } catch {
        return null;
    }
}

export type SummaryState = {
    data: StatsSummary | null;
    updatedAt: Date | null;
    failedAt: Date | null;
};

export function useStatsSummary(): SummaryState {
    const [state, setState] = useState<SummaryState>({
        data: null,
        updatedAt: null,
        failedAt: null,
    });

    useEffect(() => {
        let alive = true;
        let loading = false;

        async function load() {
            // A slow answer is never overtaken by a second request
            if (loading) return;
            loading = true;
            const data = await get("/api/stats", parseSummary);
            loading = false;
            if (!alive) return;
            // A failure keeps the last good data on screen
            setState((s) =>
                data
                    ? { data, updatedAt: new Date(), failedAt: null }
                    : { ...s, failedAt: new Date() },
            );
        }

        const visible = () => document.visibilityState === "visible";
        const tick = setInterval(() => {
            if (visible()) void load();
        }, REFRESH_MS);
        const onVisible = () => {
            if (visible()) void load();
        };
        document.addEventListener("visibilitychange", onVisible);
        void load();
        return () => {
            alive = false;
            clearInterval(tick);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, []);

    return state;
}

export function fetchPage(kind: "sessions", before?: string): Promise<Page<SessionRow> | null>;
export function fetchPage(kind: "payments", before?: string): Promise<Page<PaymentRow> | null>;
export function fetchPage(
    kind: "sessions" | "payments",
    before?: string,
): Promise<Page<SessionRow> | Page<PaymentRow> | null> {
    const query = before === undefined ? "" : `?before=${encodeURIComponent(before)}`;
    const url = `/api/stats/${kind}${query}`;
    return kind === "sessions" ? get(url, parseSessions) : get(url, parsePayments);
}
