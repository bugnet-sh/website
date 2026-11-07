import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { copy } from "../copy.ts";
import { GAP } from "../map/layout.ts";

const read = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");
const html = read("./index.html");
const css = read("./page.css");
const tokensCss = read("../../../brand/tokens.css");
const doc = new JSDOM(html).window.document;
const squash = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

describe("index.html", () => {
    it("sets the head the build fills in", () => {
        expect(doc.documentElement.lang).toBe("en");
        expect(doc.querySelector("meta[charset]")?.getAttribute("charset")).toBe("utf-8");
        const meta = (name: string) =>
            doc.querySelector(`meta[name="${name}"]`)?.getAttribute("content");
        expect(meta("viewport")).toBe("width=device-width, initial-scale=1");
        expect(meta("referrer")).toBe("no-referrer");
        expect(meta("robots")).toBe("noindex, nofollow, noarchive");
        expect(meta("color-scheme")).toBe("dark");
        expect(doc.title).toBe(copy.title);
        expect(doc.querySelector('link[rel="icon"]')?.getAttribute("href")).toBe("__ICON__");
        const style = doc.querySelector('link[rel="stylesheet"]');
        expect(style?.getAttribute("href")).toBe("__PAGE_CSS__");
        expect(style?.getAttribute("integrity")).toBe("__PAGE_CSS_INTEGRITY__");
        const script = doc.querySelector("script");
        expect(script?.getAttribute("src")).toBe("__PAGE_JS__");
        expect(script?.getAttribute("integrity")).toBe("__PAGE_JS_INTEGRITY__");
        expect(script?.hasAttribute("defer")).toBe(true);
    });

    it("holds only the two comments the build replaces", () => {
        expect(html.match(/<!--[^>]*-->/g)).toEqual(["<!--FONT_PRELOADS-->", "<!--LOGO-->"]);
        expect(doc.head.innerHTML).toContain("<!--FONT_PRELOADS-->");
        expect(doc.querySelector("header.site a.logo")?.innerHTML.trim()).toBe("<!--LOGO-->");
    });

    it("links the logo home, and shows the banner, the fallback and the footer", () => {
        const logo = doc.querySelector("header.site a.logo")!;
        expect(logo.getAttribute("href")).toBe("https://bugnet.sh/");
        expect(logo.getAttribute("aria-label")).toBe(copy.logoLabel);
        expect(logo.getAttribute("rel")).toBe("noreferrer");
        const banner = doc.querySelector("p.banner")!;
        expect(banner.getAttribute("role")).toBe("note");
        expect(squash(banner.textContent)).toBe(copy.banner);
        expect(squash(doc.querySelector("main#app noscript")?.textContent)).toBe(copy.noScript);
        const links = [...doc.querySelectorAll("footer.site a")].map((a) => ({
            text: squash(a.textContent),
            href: a.getAttribute("href"),
            rel: a.getAttribute("rel"),
        }));
        expect(links).toEqual([
            { text: copy.footer.terms, href: "https://bugnet.sh/terms", rel: "noreferrer" },
            { text: copy.footer.privacy, href: "https://bugnet.sh/privacy", rel: "noreferrer" },
            { text: copy.footer.reportAbuse, href: "mailto:abuse@bugnet.org", rel: "noreferrer" },
        ]);
    });

    it("marks the logo, the banner and the footer as sharing the left edge", () => {
        const edges = [...doc.querySelectorAll("[data-edge]")].map((e) => e.className);
        expect(edges).toEqual(["logo", "banner", "site"]);
    });
});

describe("headers.txt", () => {
    it("is exactly the headers every file is served with", () => {
        expect(read("./headers.txt")).toBe(
            [
                "Cache-Control: no-store",
                "Referrer-Policy: no-referrer",
                "X-Content-Type-Options: nosniff",
                "Cross-Origin-Opener-Policy: same-origin",
                "X-Robots-Tag: noindex, nofollow, noarchive",
                "Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; require-trusted-types-for 'script'; trusted-types 'none'",
                "",
            ].join("\n"),
        );
    });
});

/* page.css */

const plain = css.replace(/\/\*[\s\S]*?\*\//g, "");
const declarations = [...plain.matchAll(/([-\w]+)\s*:\s*([^;{}]+);/g)].map((m) => ({
    property: m[1]!,
    value: m[2]!.trim(),
}));
const rules = [...plain.replace(/@import[^;]*;/g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
    (m) => ({
        selector: m[1]!.trim(),
        body: m[2]!,
    }),
);
const ruleFor = (selector: string) => rules.find((r) => r.selector === selector)?.body ?? "";

describe("page.css", () => {
    it("starts from the brand tokens and keeps hidden things hidden", () => {
        expect(plain.trimStart().startsWith('@import "@bugnet/brand/tokens.css";')).toBe(true);
        expect(rules[0]?.selector).toBe("[hidden]");
        expect(rules[0]?.body).toMatch(/display:\s*none\s*!important/);
    });

    it("takes every colour, font and size from a token", () => {
        expect(declarations.length).toBeGreaterThan(100);
        for (const { property, value } of declarations) {
            if (property.startsWith("--")) continue;
            expect(value, property).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
            expect(value, property).not.toMatch(/\d(px|rem|em|pt|vh|vw)\b/);
            if (property === "font-family") expect(value).toMatch(/^var\(--font-/);
        }
    });

    it("keeps output blocks to themselves", () => {
        const block = ruleFor(".term-cmd,\n.term-out");
        for (const d of ["white-space: pre", "overflow-x: auto", "contain: content"]) {
            expect(block).toContain(d);
        }
        expect(block).toContain("max-height: var(--term-max)");
        // At most 480 px, and short of a landscape phone's height, so the page can still scroll
        expect(css).toMatch(/--term-max:\s*min\(480px, 60svh\);/);
        expect(css).toMatch(/--events-max:\s*min\(480px, 60svh\);/);
        expect(ruleFor(".table-scroll")).toContain("max-height: var(--events-max)");
        expect(ruleFor(".line")).toContain("overflow: hidden");
        expect(ruleFor(".line-err")).toContain("color: var(--text-muted)");
        expect(ruleFor(".line-err")).toContain("border-left: var(--hairline) solid var(--line)");
    });

    it("shows focus in the accent, and stops the dot for reduced motion and hidden tabs", () => {
        expect(ruleFor(":focus-visible")).toContain("outline: var(--ring) solid var(--accent)");
        expect(ruleFor(":focus-visible")).toContain("outline-offset: var(--ring)");
        // A click or a tap draws no outline, the browser's own ring included
        expect(ruleFor(":focus:not(:focus-visible)").trim()).toBe("outline: none;");
        for (const rule of rules.filter((r) => /:focus(?!-visible)/.test(r.selector))) {
            expect(rule.body.trim(), rule.selector).toBe("outline: none;");
        }
        expect(tokensCss).toMatch(/--ring:\s*2px;/);
        expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.dot\s*\{/);
        expect(ruleFor(".is-hidden-tab .dot")).toContain("animation: none");
    });

    it("keeps hover styles for a pointer that hovers, so a tap leaves no accent behind", () => {
        let rest = plain;
        for (;;) {
            const at = rest.indexOf("@media (hover: hover)");
            if (at < 0) break;
            let depth = 0;
            let end = rest.indexOf("{", at);
            for (; end < rest.length; end++) {
                if (rest[end] === "{") depth++;
                else if (rest[end] === "}" && --depth === 0) break;
            }
            expect(rest.slice(at, end)).toContain(":hover");
            rest = rest.slice(0, at) + rest.slice(end + 1);
        }
        expect(plain).toContain("@media (hover: hover)");
        expect(rest).not.toContain(":hover");
        expect(ruleFor(".copy-button.is-copied")).toContain("color: var(--accent)");
    });

    it("takes the hairline, the ring and the dot from the brand tokens, defined once", () => {
        for (const [token, value] of [
            ["--hairline", "1px"],
            ["--ring", "2px"],
            ["--dot", "8px"],
        ]) {
            expect(tokensCss).toContain(`${token}: ${value};`);
            expect(plain, token).not.toMatch(new RegExp(`${token}\\s*:`));
        }
    });

    it("dashes a refused edge from a token, not from the drawing code", () => {
        expect(ruleFor(".map-edge.warn")).toContain("stroke-dasharray: var(--dash)");
        expect(css).toMatch(/--dash:\s*6px 4px;/);
    });

    it("sizes the phone list's empty line like the rest of its small text", () => {
        expect(ruleFor(".map-edge-label text,\n.map-metric,\n.map-svg .map-empty")).toContain(
            "font-size: var(--map-metric-size)",
        );
        const list = ruleFor(".map-list .map-empty");
        expect(list).toContain("font-size: var(--small-size)");
        expect(list).toContain("line-height: var(--small-line)");
    });

    it("sets the map's gap between parts to the page's own inline gap", () => {
        const tokenOf = (source: string, name: string) =>
            new RegExp(`${name}:\\s*([^;]+);`).exec(source)?.[1]?.trim();
        const gap = tokenOf(css, "--gap-inline");
        const space = /^var\((--[\w-]+)\)$/.exec(gap ?? "")?.[1];
        const value = space === undefined ? gap : tokenOf(tokensCss, space);
        expect(value).toBe(`${GAP}px`);
    });

    it("turns the map into a list and drops the wide columns below 768 px", () => {
        const phone = plain.slice(plain.indexOf("@media (max-width: 767.98px)"));
        expect(phone).toMatch(/\.map-svg\s*\{\s*display: none;/);
        expect(phone).toMatch(/\.map-list\s*\{\s*display: block;/);
        expect(phone).toMatch(/\.col-wide\s*\{\s*display: none;/);
    });
});
