import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchPage, useStatsSummary } from "./client";
import { fakeSummary } from "./testing/fake-data";

const ok = () => new Response(JSON.stringify(fakeSummary(1, "normal")));
let visibility = "visible";
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
    vi.useFakeTimers();
    visibility = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(
        () => visibility as DocumentVisibilityState,
    );
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ok());
});

afterEach(() => {
    // Without globals, Testing Library does not unmount on its own
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

const flush = () => act(() => vi.advanceTimersByTimeAsync(0));
const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

it("fetches at once with a private request, then every 30 s", async () => {
    const { result } = renderHook(() => useStatsSummary());
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]).toEqual([
        "/api/stats",
        { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" },
    ]);
    expect(result.current.data?.version).toBe(1);
    await wait(29_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await wait(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("pauses while hidden and refetches when visible again", async () => {
    renderHook(() => useStatsSummary());
    await flush();
    visibility = "hidden";
    await wait(120_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    visibility = "visible";
    await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
    });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("keeps the data and sets failedAt when a refresh fails", async () => {
    const { result } = renderHook(() => useStatsSummary());
    await flush();
    const data = result.current.data;
    fetchMock.mockImplementation(
        async () => new Response('{"error":"unavailable"}', { status: 503 }),
    );
    await wait(30_000);
    expect(result.current.data).toBe(data);
    expect(result.current.failedAt).not.toBeNull();
    // No retry sooner than the cadence
    await wait(29_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockImplementation(async () => ok());
    await wait(1_000);
    expect(result.current.failedAt).toBeNull();
});

it("treats a wrong shape as a failure", async () => {
    fetchMock.mockImplementation(async () => new Response('{"version":2}'));
    const { result } = renderHook(() => useStatsSummary());
    await flush();
    expect(result.current.data).toBeNull();
    expect(result.current.failedAt).not.toBeNull();
});

it("fetchPage sends the cursor and returns null on failure", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 429 }));
    expect(await fetchPage("sessions", "c_50 x")).toBeNull();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/stats/sessions?before=c_50%20x");
    fetchMock.mockImplementation(async () => {
        throw new Error("offline");
    });
    expect(await fetchPage("payments")).toBeNull();
});
