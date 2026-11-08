import { describe, expect, it } from "vitest";
import { isExternal, siteHref } from "./href";

describe("siteHref", () => {
    it("gives a site page the trailing slash its exported folder is served at", () => {
        expect(siteHref("/privacy")).toBe("/privacy/");
        expect(siteHref("/terms#session-page")).toBe("/terms/#session-page");
        expect(siteHref("/docs/paying?x=1#top")).toBe("/docs/paying/?x=1#top");
    });

    it("leaves anchors, files, slashed paths and other sites alone", () => {
        for (const href of ["#refunds", "/stats/#limits", "/", "/fonts/a.txt", "https://x.com/a"]) {
            expect(siteHref(href)).toBe(href);
        }
    });
});

describe("isExternal", () => {
    it("is true for http and https links only", () => {
        expect(isExternal("https://github.com/bugnet-sh/bugnet")).toBe(true);
        expect(isExternal("http://example.com")).toBe(true);
        expect(isExternal("/privacy")).toBe(false);
        expect(isExternal("#summary")).toBe(false);
        expect(isExternal("mailto:support@bugnet.org")).toBe(false);
    });
});
