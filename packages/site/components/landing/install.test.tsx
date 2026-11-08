import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { InstallTabs } from "./install";

afterEach(cleanup);

const tabs = ["Claude Code", "Cursor", "Codex CLI"].map((name) => ({
    id: name,
    name,
    panel: <p>{`${name} lines`}</p>,
}));

const selected = () => screen.getByRole("tab", { selected: true });

it("moves between tabs with the arrow keys, Home and End", () => {
    render(<InstallTabs tabs={tabs} />);
    expect(screen.getByRole("tablist")).toBeTruthy();
    expect(selected().textContent).toBe("Claude Code");
    expect(screen.getByRole("tabpanel").textContent).toBe("Claude Code lines");

    fireEvent.keyDown(selected(), { key: "ArrowRight" });
    expect(selected().textContent).toBe("Cursor");
    expect(document.activeElement).toBe(selected());
    expect(screen.getByRole("tabpanel").textContent).toBe("Cursor lines");

    fireEvent.keyDown(selected(), { key: "ArrowLeft" });
    fireEvent.keyDown(selected(), { key: "ArrowLeft" });
    expect(selected().textContent).toBe("Codex CLI");

    fireEvent.keyDown(selected(), { key: "Home" });
    expect(selected().textContent).toBe("Claude Code");
    fireEvent.keyDown(selected(), { key: "End" });
    expect(selected().textContent).toBe("Codex CLI");
    expect(selected().getAttribute("tabindex")).toBe("0");
    expect(screen.getAllByRole("tab", { selected: false })[0]?.getAttribute("tabindex")).toBe("-1");
});
