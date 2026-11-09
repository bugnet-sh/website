import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Markdown } from "./markdown";

vi.mock("../../components/content/mermaid", () => ({
    Mermaid: ({ source }: { source: string }) => <figure>{source}</figure>,
}));

afterEach(cleanup);

// jsdom has no ResizeObserver, which a block that scrolls sideways listens with
beforeEach(() => {
    vi.stubGlobal(
        "ResizeObserver",
        class {
            observe() {}
            disconnect() {}
        },
    );
});

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

it("wraps a shell block line by line, its text whole, and leaves a JSON block to scroll", () => {
    const source = [
        "```sh",
        "claude mcp add --scope user bugnet",
        "pay setup",
        "```",
        "",
        "```json",
        "{}",
        "```",
    ].join("\n");
    render(<Markdown source={source} look="article" />);
    const [shell, json] = document.querySelectorAll("pre");
    expect(shell?.textContent).toBe("claude mcp add --scope user bugnet\npay setup");
    expect(shell?.querySelectorAll("code > span")).toHaveLength(2);
    expect(shell?.className).toContain("whitespace-pre-wrap");
    expect(json?.className).not.toContain("whitespace-pre-wrap");
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

it("turns a GitHub alert into a callout with its title, and leaves a plain quote a quote", () => {
    const source = [
        "> [!WARNING]",
        "> **Keep a small balance**",
        "> Any process running as you can read the file.",
        "",
        "> Try this repo for me.",
    ].join("\n");
    const { container } = render(<Markdown source={source} look="article" />);
    const note = screen.getByRole("note");
    expect(note.querySelector("[data-callout-head]")?.textContent).toBe("Warning");
    expect(note.querySelector("[data-callout-title]")?.textContent).toBe("Keep a small balance");
    expect(note.textContent).toContain("Any process running as you can read the file.");
    expect(note.textContent).not.toContain("[!WARNING]");
    expect(container.querySelector("blockquote")?.textContent?.trim()).toBe(
        "Try this repo for me.",
    );
});

it("marks a numbered H2 as a step and keeps its id and spoken number", () => {
    render(<Markdown source={"## 3. Ask your agent {#ask-your-agent}\n"} look="article" />);
    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h2.id).toBe("ask-your-agent");
    expect(h2.querySelector("[aria-hidden]")?.textContent).toBe("03");
    expect(h2.textContent).toContain("3. Ask your agent");
});

it("shows fences in a row that name tabs as one tabbed block, every panel in the page", () => {
    const source = [
        '```sh tab="Claude Code"',
        "claude mcp add bugnet",
        "```",
        "",
        '```json tab="Cursor"',
        '{ "url": "https://mcp.bugnet.sh/mcp" }',
        "```",
    ].join("\n");
    render(<Markdown source={source} look="article" />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Claude Code", "Cursor"]);
    const panels = document.querySelectorAll("[role=tabpanel]");
    expect([...panels].map((panel) => panel.querySelector("pre")?.textContent)).toEqual([
        "claude mcp add bugnet",
        '{ "url": "https://mcp.bugnet.sh/mcp" }',
    ]);
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tabs[0] as HTMLElement, { key: "ArrowRight" });
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tabs[1]);
    expect(panels[0]?.className).toContain("hidden");
    expect(panels[1]?.className).not.toContain("hidden");
});

it("draws the list under Next steps as linked cards, and leaves other lists alone", () => {
    const source = [
        "## Next steps",
        "",
        "- [Install](/docs/install/): Every client's setup.",
        "- [Paying](/docs/paying/): How a run is paid.",
        "",
        "## More",
        "",
        "- [Install](/docs/install/): Every client's setup.",
    ].join("\n");
    render(<Markdown source={source} look="article" />);
    const cards = screen
        .getAllByRole("link")
        .filter((a) => a.getAttribute("href")?.startsWith("/docs/"));
    expect(cards.map((a) => [a.getAttribute("href"), a.textContent])).toEqual([
        ["/docs/install/", "InstallEvery client's setup."],
        ["/docs/paying/", "PayingHow a run is paid."],
        ["/docs/install/", "Install"],
    ]);
    expect(cards[2]?.closest("li")?.textContent).toBe("Install: Every client's setup.");
});

it("plays a clip in a titled frame only while half of it is on screen", async () => {
    let report: (ratio: number) => void = () => undefined;
    vi.stubGlobal(
        "IntersectionObserver",
        class {
            constructor(callback: (entries: { intersectionRatio: number }[]) => void) {
                report = (ratio) => callback([{ intersectionRatio: ratio }]);
            }
            observe() {}
            disconnect() {}
        },
    );
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});

    render(<Markdown source={"![Pay with Touch ID](/docs/clips/made-up.mp4)\n"} look="article" />);
    const figure = screen.getByRole("figure");
    expect(figure.parentElement?.tagName).not.toBe("P");
    expect(figure.querySelector("figcaption")?.textContent).toBe("Pay with Touch ID");
    const video = figure.querySelector("video") as HTMLVideoElement;
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(video.getAttribute("preload")).toBe("metadata");
    expect(video.getAttribute("poster")).toBe("/docs/clips/made-up.jpg");
    expect([...video.querySelectorAll("source")].map((s) => s.getAttribute("type"))).toEqual([
        "video/webm",
        "video/mp4",
    ]);
    expect(video.querySelector("source")?.getAttribute("src")).toBe("/docs/clips/made-up.webm");

    report(0.3);
    expect(play).not.toHaveBeenCalled();
    report(0.6);
    expect(play).toHaveBeenCalledTimes(1);
    report(0.2);
    expect(pause).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});
