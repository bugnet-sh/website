import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SandboxPay } from "./sandbox-pay";

afterEach(cleanup);

it("says what the visitor gains, with Solana in its gradient once", () => {
    const { container } = render(<SandboxPay />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toBe(
        "Your sandbox pays for the APIs it needs. You approve one allowance in USDC on Solana, not every call.",
    );
    expect(screen.getByRole("region", { name: heading.textContent ?? "" })).toBeTruthy();
    const gradients = container.querySelectorAll("[class*='--solana-purple']");
    expect(gradients).toHaveLength(1);
    expect(gradients[0]?.textContent).toBe("Solana");
});

it("shows three items in plain sentences, true to the x402-in-sandboxes spec", () => {
    render(<SandboxPay />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(
        items.map((item) => within(item).getByRole("heading", { level: 3 }).textContent),
    ).toEqual(["No API key needed", "Paid call by call", "Capped and refunded"]);
    expect(items.map((item) => item.querySelector("p")?.textContent)).toEqual([
        "When the code needs an API you have no key for, your agent finds a similar one that takes x402 payments and points the code at it.",
        "The code pays each call from your allowance without asking you, and no wallet key ever enters the sandbox.",
        "Payments stop at your limits, and never pass 0.50 USDC a call or 5 USDC per sandbox. Anything left over goes back to your wallet when the sandbox ends, if it's 0.01 USDC or more.",
    ]);
    for (const item of items) {
        expect(item.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    }
});

it("links nowhere, since no docs page covers paying from the sandbox yet", () => {
    render(<SandboxPay />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
});

it("keeps protocol jargon and the middle dot out of its words", () => {
    const { container } = render(<SandboxPay />);
    const words = container.querySelector("section")?.textContent ?? "";
    expect(words).not.toMatch(/\b402\b|HTTP|settle/i);
    expect(words).not.toContain("·");
});

it("cuts each drawing's line at its own edges once the cells stack", () => {
    render(<SandboxPay />);
    for (const item of screen.getAllByRole("listitem")) {
        const art = item.querySelector("svg")?.parentElement;
        expect(art?.className).toContain("tablet:[--art-overflow:hidden]");
    }
});
