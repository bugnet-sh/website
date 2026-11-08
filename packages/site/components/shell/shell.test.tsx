import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SiteFooter } from "./footer";
import { SiteHeader } from "./header";

afterEach(cleanup);

function textNodes(root: Node): string[] {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const texts: string[] = [];
    while (walker.nextNode()) texts.push(walker.currentNode.textContent ?? "");
    return texts;
}

describe("the shell", () => {
    it("never writes a middle dot, in any text or label", () => {
        const { container } = render(
            <>
                <SiteHeader current="home" />
                <SiteFooter />
            </>,
        );
        fireEvent.click(screen.getByRole("button", { name: "Menu" }));
        const texts = textNodes(container);
        expect(texts.length).toBeGreaterThan(0);
        for (const text of texts) expect(text).not.toContain("·");
        for (const el of container.querySelectorAll("[aria-label]")) {
            expect(el.getAttribute("aria-label")).not.toContain("·");
        }
    });
});
