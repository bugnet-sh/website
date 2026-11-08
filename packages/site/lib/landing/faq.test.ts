import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readDoc } from "../content/doc-file";
import { docBySlug, type Doc } from "../content/docs";
import { tocOf } from "../content/toc";
import { faqItems, landingFaq, landingQuestions } from "./faq";

// Tests run from the repository root, not the folder `next build` reads from
const dir = fileURLToPath(new URL("../../content/docs", import.meta.url));
const faq = () => readDoc(docBySlug("faq") as Doc, dir).body;

const sample = `# FAQ

## Is it free?

No. See [Prices](/docs/paying/#prices).

Second paragraph.

## Can I keep a sandbox? {#keep}

No, it is deleted at the deadline.

## Is it free?

Asked twice.
`;

describe("faqItems", () => {
    it("takes each question with the Markdown under it, by the ids the docs page renders", () => {
        expect(faqItems(sample)).toEqual([
            {
                id: "is-it-free",
                question: "Is it free?",
                answer: "No. See [Prices](/docs/paying/#prices).\n\nSecond paragraph.",
            },
            {
                id: "keep",
                question: "Can I keep a sandbox?",
                answer: "No, it is deleted at the deadline.",
            },
            { id: "is-it-free-1", question: "Is it free?", answer: "Asked twice." },
        ]);
    });

    it("fails on a question with no answer", () => {
        expect(() => faqItems("## Empty?\n\n## Next?\n\nYes.")).toThrow("{#empty} has no answer");
    });
});

describe("landingFaq", () => {
    it("picks the questions in the order it is given", () => {
        expect(landingFaq(sample, ["keep", "is-it-free"]).map((item) => item.id)).toEqual([
            "keep",
            "is-it-free",
        ]);
    });

    it("fails the build when the docs drop a question", () => {
        expect(() => landingFaq(sample, ["gone"])).toThrow("faq.md has no question {#gone}");
    });

    it("finds every landing question in the docs' FAQ, with the heading the docs page shows", () => {
        const headings = new Map(tocOf(faq()).map((item) => [item.id, item.text]));
        const items = landingFaq(faq());
        expect(items).toHaveLength(landingQuestions.length);
        expect(items.length).toBeGreaterThanOrEqual(7);
        expect(items.length).toBeLessThanOrEqual(9);
        for (const item of items) {
            expect(item.question).toBe(headings.get(item.id));
            expect(faq()).toContain(item.answer);
        }
    });

    it("keeps protocol words out of the landing's questions and answers", () => {
        for (const item of landingFaq(faq())) {
            expect(`${item.question} ${item.answer}`, item.id).not.toMatch(
                /\b(402|HTTP|stdio|settles?)\b/i,
            );
        }
    });
});
