import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Markdown } from "./markdown";

vi.mock("../../components/content/mermaid", () => ({
    Mermaid: ({ source }: { source: string }) => <figure>{source}</figure>,
}));

afterEach(cleanup);

it("draws a mermaid fence as a diagram and keeps every other fence a code block", () => {
    const source = [
        "```mermaid",
        "flowchart LR",
        "    A --> B",
        "```",
        "",
        "```sh",
        "claude mcp add bugnet",
        "```",
    ].join("\n");
    render(<Markdown source={source} />);
    expect(screen.getByRole("figure").textContent).toBe("flowchart LR\n    A --> B");
    expect(screen.getAllByRole("button", { name: "Copy code" })).toHaveLength(1);
    expect(document.querySelector("pre")?.textContent).toBe("claude mcp add bugnet");
});

it("puts a title action in the H1's row, and leaves an H1 without one alone", () => {
    const source = "# Paying {#paying}\n\nPay.\n";
    const { container } = render(
        <Markdown source={source} titleAction={<button type="button">Copy Markdown</button>} />,
    );
    const h1 = container.querySelector("h1#paying") as HTMLElement;
    expect(h1.textContent).toBe("Paying");
    const row = h1.parentElement as HTMLElement;
    expect(row.querySelector("button")?.textContent).toBe("Copy Markdown");
    expect(row.nextElementSibling?.textContent).toBe("Pay.");
    cleanup();

    const bare = render(<Markdown source={source} />).container;
    expect(bare.querySelector("h1")?.parentElement).toBe(bare);
    expect(bare.querySelector("button")).toBeNull();
});
