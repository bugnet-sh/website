import { describe, expect, it } from "vitest";
import { docBySlug, docHref, docs, prevNext } from "./docs";

describe("docs", () => {
    it("serves Install at /docs/ and the rest under their slugs", () => {
        expect(docs.map(docHref)).toEqual([
            "/docs/",
            "/docs/before-you-pay/",
            "/docs/paying/",
            "/docs/tools/",
            "/docs/limits/",
            "/docs/safety/",
            "/docs/watching-a-run/",
            "/docs/faq/",
        ]);
        expect(docBySlug("paying")?.title).toBe("Paying");
        expect(docBySlug("nope")).toBeUndefined();
    });

    it("gives the first page no previous and the last no next", () => {
        expect(prevNext("")).toEqual({ prev: undefined, next: docBySlug("before-you-pay") });
        expect(prevNext("faq")).toEqual({ prev: docBySlug("watching-a-run"), next: undefined });
    });

    it("gives a middle page both neighbours", () => {
        expect(prevNext("tools")).toEqual({ prev: docBySlug("paying"), next: docBySlug("limits") });
    });
});
