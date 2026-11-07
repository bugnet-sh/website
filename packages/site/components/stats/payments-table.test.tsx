import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { formatUsdc } from "../../lib/stats/format";
import { parsePayments } from "../../lib/stats/parse";
import { fakePayments } from "../../lib/stats/testing/fake-data";
import type { Page, PaymentRow } from "../../lib/stats/types";
import { PaymentsTable } from "./payments-table";

afterEach(cleanup);

it("names each payment and shows money going back with a minus in the muted colour", async () => {
    const page = parsePayments(fakePayments(1, "normal")) as Page<PaymentRow>;
    const { container } = render(<PaymentsTable load={async () => page} />);
    await act(async () => {});

    const rows = [...container.querySelectorAll("tbody tr")].slice(0, 5);
    const cells = rows.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent));
    expect(cells.map((row) => row[1])).toEqual([
        "Sandbox",
        "Extension",
        "x402 allowance",
        "Refund",
        "Allowance returned",
    ]);
    expect(cells.map((row) => row[2])).toEqual([
        "Checkout page",
        "pay CLI",
        "Checkout page",
        "",
        "",
    ]);

    const amount = (i: number) => rows[i]?.querySelector(".font-mono") as HTMLElement;
    expect(amount(0).className).toContain("text-accent-2");
    expect(amount(3).textContent).toBe(`−${formatUsdc(page.items[3]?.amountMicros ?? 0)}`);
    expect(amount(3).className).toContain("text-text-muted");
    expect(container.textContent).not.toContain("·");
});
