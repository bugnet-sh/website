import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CopyButton } from "./copy-button";

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

afterEach(cleanup);

/** The words a sighted reader sees: the one not hidden by `invisible`. */
const visible = (button: HTMLElement) =>
    [...button.querySelectorAll("span[aria-hidden]")]
        .filter((span) => !span.classList.contains("invisible"))
        .map((span) => span.textContent);

it("labelled, shows its icon and label, copies the text, then says Copied", async () => {
    render(<CopyButton text={"# Paying\n"} label="Copy Markdown" form="labelled" />);
    const button = screen.getByRole("button", { name: "Copy Markdown" });
    expect(button.querySelector("svg")).not.toBeNull();
    expect(visible(button)).toEqual(["Copy Markdown"]);

    await act(async () => fireEvent.click(button));
    expect(writeText).toHaveBeenCalledWith("# Paying\n");
    expect(visible(button)).toEqual(["Copied"]);
    expect(screen.getByRole("status").textContent).toBe("Copied");
});

it("says the copy failed when the clipboard refuses", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(<CopyButton text="x" label="Copy Markdown" form="labelled" />);
    const button = screen.getByRole("button", { name: "Copy Markdown" });
    await act(async () => fireEvent.click(button));
    expect(visible(button)).toEqual(["Copy failed"]);
});

it("keeps the icon form wordless and the word form iconless", () => {
    render(
        <>
            <CopyButton text="a" label="Copy code" form="icon" />
            <CopyButton text="b" label="Copy wallet address" />
        </>,
    );
    const icon = screen.getByRole("button", { name: "Copy code" });
    expect(icon.querySelector("svg")).not.toBeNull();
    expect(visible(icon)).toEqual([]);
    const words = screen.getByRole("button", { name: "Copy wallet address" });
    expect(words.querySelector("svg")).toBeNull();
    expect(visible(words)).toEqual(["Copy"]);
});
