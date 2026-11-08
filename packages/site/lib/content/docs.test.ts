import { describe, expect, it } from "vitest";
import { docBySlug, docHref, docs, docsByGroup, prevNext } from "./docs";

describe("docs", () => {
    it("serves Get started at /docs/ and the rest under their slugs", () => {
        expect(docs.map(docHref)).toEqual([
            "/docs/",
            "/docs/install/",
            "/docs/before-you-pay/",
            "/docs/paying/",
            "/docs/tools/",
            "/docs/limits/",
            "/docs/watching-a-run/",
            "/docs/safety/",
            "/docs/faq/",
        ]);
        expect(docBySlug("paying")?.title).toBe("Paying");
        expect(docBySlug("nope")).toBeUndefined();
    });

    it("gives the first page no previous and the last no next", () => {
        expect(prevNext("")).toEqual({ prev: undefined, next: docBySlug("install") });
        expect(prevNext("faq")).toEqual({ prev: docBySlug("safety"), next: undefined });
    });

    it("gives a middle page both neighbours", () => {
        expect(prevNext("tools")).toEqual({ prev: docBySlug("paying"), next: docBySlug("limits") });
    });

    it("lists the sidebar's groups in reading order, each page in one group", () => {
        expect(
            docsByGroup().map(({ group, docs }) => [group, docs.map((doc) => doc.title)]),
        ).toEqual([
            ["Start", ["Get started", "Install"]],
            ["Paying", ["Before you pay", "Paying"]],
            ["Using Bugnet", ["Tools", "Limits", "Watching a run"]],
            ["Safety", ["Safety"]],
            ["Help", ["FAQ"]],
        ]);
        expect(docsByGroup().flatMap((g) => g.docs)).toEqual(docs);
    });
});
