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
