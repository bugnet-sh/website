import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { readDoc } from "../../lib/content/doc-file";
import { docBySlug, type Doc } from "../../lib/content/docs";
import { tocOf } from "../../lib/content/toc";
import { landingFaq, landingQuestions } from "../../lib/landing/faq";
import { FaqBand } from "./faq";

afterEach(cleanup);

// Tests run from the repository root, not the folder `next build` reads from
const dir = join(dirname(fileURLToPath(import.meta.url)), "../../content/docs");
const source = readDoc(docBySlug("faq") as Doc, dir).body;
const items = landingFaq(source);

const questions = () => screen.getAllByRole("button");
const answerOf = (button: HTMLElement) =>
    document.getElementById(button.getAttribute("aria-controls") ?? "") as HTMLElement;

/** What a browser does with a key on a focused button: Enter and Space press it. */
function press(element: HTMLElement, key: string) {
    const go = fireEvent.keyDown(element, { key });
    if (go && element.tagName === "BUTTON" && (key === "Enter" || key === " ")) {
        fireEvent.click(element);
    }
}

describe("FaqBand", () => {
    it("titles the band FAQ and sends readers to the docs or to support", () => {
        render(<FaqBand items={items} />);
        const heading = screen.getByRole("heading", { level: 2, name: "FAQ" });
        const text = heading.nextElementSibling as HTMLElement;
        expect(text.textContent).toBe(
            "If you have more questions, read our documentation or email us at support@bugnet.org.",
        );
        const links = within(text).getAllByRole("link");
        expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
            ["documentation", "/docs/"],
            ["support@bugnet.org", "mailto:support@bugnet.org"],
        ]);
    });

    it("asks the docs' questions, word for word, in the landing's order", () => {
        render(<FaqBand items={items} />);
        const headings = new Map(tocOf(source).map((item) => [item.id, item.text]));
        expect(questions().map((b) => b.textContent)).toEqual(
            landingQuestions.map((id) => headings.get(id)),
        );
        expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(landingQuestions.length);
    });

    it("renders each answer from the docs, links included", () => {
        render(<FaqBand items={items} />);
        const cost = screen.getByRole("button", { name: "What does a run cost?" });
        press(cost, "Enter");
        const answer = answerOf(cost);
        expect(answer.textContent).toContain("You see the price before you pay");
        expect(within(answer).getByRole("link", { name: "Prices" }).getAttribute("href")).toBe(
            "/docs/paying/#prices",
        );
    });

    it("starts with every answer closed", () => {
        render(<FaqBand items={items} />);
        for (const button of questions()) {
            expect(button.getAttribute("aria-expanded")).toBe("false");
            expect(answerOf(button).hidden).toBe(true);
        }
    });

    it("opens and closes an answer with Enter and Space", () => {
        render(<FaqBand items={items} />);
        const first = questions()[0] as HTMLElement;
        expect(first.getAttribute("type")).toBe("button");
        first.focus();
        expect(document.activeElement).toBe(first);

        press(first, "Enter");
        expect(first.getAttribute("aria-expanded")).toBe("true");
        expect(answerOf(first).hidden).toBe(false);
        expect(answerOf(first).textContent).toContain("No.");

        press(first, " ");
        expect(first.getAttribute("aria-expanded")).toBe("false");
        expect(answerOf(first).hidden).toBe(true);
    });

    it("keeps an open answer open while another opens", () => {
        render(<FaqBand items={items} />);
        const [first, second] = questions() as [HTMLElement, HTMLElement];
        press(first, "Enter");
        press(second, "Enter");
        expect(first.getAttribute("aria-expanded")).toBe("true");
        expect(second.getAttribute("aria-expanded")).toBe("true");
    });

    it("moves between questions with the arrow keys, Home and End", () => {
        render(<FaqBand items={items} />);
        const all = questions();
        const first = all[0] as HTMLElement;
        const last = all.at(-1) as HTMLElement;
        first.focus();

        press(first, "ArrowDown");
        expect(document.activeElement).toBe(all[1]);
        press(all[1] as HTMLElement, "ArrowUp");
        expect(document.activeElement).toBe(first);
        press(first, "ArrowUp");
        expect(document.activeElement).toBe(last);
        press(last, "ArrowDown");
        expect(document.activeElement).toBe(first);
        press(first, "End");
        expect(document.activeElement).toBe(last);
        press(last, "Home");
        expect(document.activeElement).toBe(first);
        // Moving focus opens nothing
        expect(all.every((b) => b.getAttribute("aria-expanded") === "false")).toBe(true);
    });

    it("puts each question's button in a heading, so a screen reader can jump between them", () => {
        render(<FaqBand items={items} />);
        for (const button of questions()) {
            expect(button.parentElement?.tagName).toBe("H3");
        }
    });
});
