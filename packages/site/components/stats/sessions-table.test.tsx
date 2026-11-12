import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { parseSessions } from "../../lib/stats/parse";
import {
    badWallet,
    fakeSessions,
    hostileProvider,
    shortTx,
    type Scenario,
} from "../../lib/stats/testing/fake-data";
import type { Page, SessionRow } from "../../lib/stats/types";
import { SessionsTable } from "./sessions-table";

afterEach(cleanup);

const page = (scenario: Scenario, before?: string) =>
    parseSessions(fakeSessions(1, scenario, before)) as Page<SessionRow>;

async function show(load: (before?: string) => Promise<Page<SessionRow> | null>) {
    const view = render(<SessionsTable load={load} />);
    // Lets the first page's promise settle
    await act(async () => {});
    return view;
}

const desktopRows = (root: HTMLElement) => root.querySelectorAll("tbody tr");

it("renders hostile feed strings as text, with no copy target or link from a bad value", async () => {
    const first = page("hostile");
    const { container } = await show(async () => first);

    expect(screen.getAllByText(hostileProvider).length).toBeGreaterThan(0);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).not.toContain(badWallet);
    expect(container.textContent).not.toContain(shortTx);

    // The parser nulls the bad wallet and the short tx, so their row gets neither
    const wallets = first.items.flatMap((r) => (r.wallet ? [r.wallet] : []));
    const txs = first.items.flatMap((r) => (r.tx ? [r.tx] : []));
    expect(first.items[1]?.wallet).toBeNull();
    const table = container.querySelector("table") as HTMLElement;
    expect(within(table).getAllByRole("button", { name: "Copy wallet address" })).toHaveLength(
        wallets.length,
    );
    const links = within(table).getAllByRole("link", { name: /View/ });
    expect(links.map((a) => a.getAttribute("href"))).toEqual(
        txs.map((tx) => `https://solscan.io/tx/${tx}`),
    );
    expect(links[0]?.getAttribute("rel")).toBe("noreferrer");
    expect(container.textContent).not.toContain("·");
});

it("appends the next page by its cursor, and leaves Show more out once there is none", async () => {
    const load = vi.fn(async (before?: string) => page("normal", before));
    const { container } = await show(load);
    expect(load).toHaveBeenCalledWith();
    expect(desktopRows(container)).toHaveLength(50);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Show more" })));
    expect(load).toHaveBeenLastCalledWith("c_50");
    expect(desktopRows(container)).toHaveLength(100);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Show more" })));
    expect(load).toHaveBeenLastCalledWith("c_100");
    expect(desktopRows(container)).toHaveLength(120);
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
});

it("says so in the button when a later page fails, and keeps the rows it has", async () => {
    const load = vi.fn(async (before?: string) => (before ? null : page("normal")));
    const { container } = await show(load);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Show more" })));
    expect(screen.getByRole("button", { name: "Couldn't load more. Try again." })).toBeDefined();
    expect(desktopRows(container)).toHaveLength(50);
});

it("says the table is unavailable when the first page fails", async () => {
    await show(async () => null);
    expect(screen.getByText("Sessions are unavailable right now.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
});

it("leaves out the wallet and tx columns when no row fills them", async () => {
    const bare = page("one-day");
    const items = bare.items.map((r) => ({ ...r, wallet: null, tx: null }));
    await show(async () => ({ items, next: null }));
    const headers = screen.getAllByRole("columnheader").map((th) => th.textContent);
    expect(headers).not.toContain("Wallet");
    expect(headers).not.toContain("Tx");
});

it("lines up the price column's decimal points, each price exact", async () => {
    const [first, second] = page("one-day").items as [SessionRow, SessionRow];
    const items = [
        { ...first, priceMicros: 50_000 },
        { ...second, priceMicros: 52_442 },
    ];
    const { container } = await show(async () => ({ items, next: null }));
    const headers = screen.getAllByRole("columnheader").map((th) => th.textContent);
    const price = headers.indexOf("Price");
    const cells = [...desktopRows(container)].map(
        (tr) => tr.querySelectorAll("td")[price]?.textContent,
    );
    expect(cells).toEqual(["0.050000USDC", "0.052442USDC"]);
});

it("folds a row on phones into a button that opens its details", async () => {
    const { container } = await show(async () => page("one-day"));
    const row = container.querySelector("ul button[aria-expanded]") as HTMLButtonElement;
    expect(row.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(row);
    expect(row.getAttribute("aria-expanded")).toBe("true");
    expect(row.parentElement?.textContent).toContain("Duration:");
    fireEvent.click(row);
    expect(row.getAttribute("aria-expanded")).toBe("false");
});
