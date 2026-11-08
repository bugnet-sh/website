import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { installLines } from "../landing/install-lines";
import { readDoc } from "./doc-file";
import { docMarkdown } from "./doc-markdown";
import { docBySlug, docs, type Doc } from "./docs";
import { llmsFiles, llmsFullTxt, llmsTxt } from "./llms";

const dir = fileURLToPath(new URL("../../content/docs", import.meta.url));
const txt = llmsTxt(dir);
const lines = txt.split("\n");

/** Each `- [name](url): note` line under a `## ` heading. */
function section(name: string): { name: string; url: string; note: string }[] {
    const start = lines.indexOf(`## ${name}`);
    const end = lines.findIndex((line, i) => i > start && line.startsWith("## "));
    return lines
        .slice(start + 1, end < 0 ? undefined : end)
        .filter((line) => line !== "")
        .map((line) => {
            const item = /^- \[([^\]]+)\]\((https:\/\/[^)]+)\): (.+)$/.exec(line);
            expect(item, line).not.toBeNull();
            return { name: item?.[1] ?? "", url: item?.[2] ?? "", note: item?.[3] ?? "" };
        });
}

describe("llms.txt", () => {
    it("opens with the name, a one-line summary and how to install", () => {
        expect(lines[0]).toBe("# Bugnet");
        expect(lines[1]).toBe("");
        expect(lines[2]).toMatch(/^> .*sandboxes for AI agents.*USDC on Solana.*no API key\.$/);
        const { hero } = installLines(readDoc(docBySlug("install") as Doc, dir).body);
        expect(hero).toMatch(/^claude mcp add /);
        expect(txt).toContain(`\`\`\`sh\n${hero}\n\`\`\``);
        expect(lines.filter((line) => /^#{1,6} /.test(line))).toEqual([
            "# Bugnet",
            "## Docs",
            "## Optional",
        ]);
    });

    it("lists every docs page in the sidebar's order, each at its Markdown address", () => {
        const items = section("Docs");
        expect(items.map((item) => item.name)).toEqual(docs.map((doc) => doc.title));
        expect(items[0]?.url).toBe("https://bugnet.sh/docs/index.md");
        expect(items.slice(1).map((item) => item.url)).toEqual(
            docs.slice(1).map((doc) => `https://bugnet.sh/docs/${doc.slug}.md`),
        );
        for (const item of items) expect(item.note.length, item.name).toBeGreaterThan(20);
    });

    it("puts the full docs, the Terms and the Privacy notice under Optional", () => {
        expect(section("Optional").map((item) => item.url)).toEqual([
            "https://bugnet.sh/llms-full.txt",
            "https://bugnet.sh/terms/",
            "https://bugnet.sh/privacy/",
        ]);
    });

    it("has no middle dot and ends with one newline", () => {
        expect(txt).not.toContain("·");
        expect(txt.endsWith("\n")).toBe(true);
        expect(txt.endsWith("\n\n")).toBe(false);
    });
});

describe("llms-full.txt", () => {
    it("is every page's clean Markdown, in the sidebar's order", () => {
        const full = llmsFullTxt(dir);
        expect(full).toBe(docs.map((doc) => docMarkdown(doc, dir)).join("\n"));
        expect(full.match(/^# .+$/gm)).toEqual(docs.map((doc) => `# ${doc.title}`));
    });
});

describe("llmsFiles", () => {
    it("writes llms.txt, llms-full.txt and one Markdown file per page", () => {
        const files = llmsFiles(dir);
        expect([...files.keys()]).toEqual([
            "/llms.txt",
            "/llms-full.txt",
            "/docs/index.md",
            ...docs.slice(1).map((doc) => `/docs/${doc.slug}.md`),
        ]);
        expect(files.get("/docs/paying.md")).toBe(docMarkdown(docBySlug("paying") as Doc, dir));
    });
});
