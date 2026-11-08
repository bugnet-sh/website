import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readDoc } from "./doc-file";
import { cleanMarkdown, docMarkdown, docMarkdownPath } from "./doc-markdown";
import { docs, type Doc } from "./docs";

const fixtures = fileURLToPath(new URL("../../test/fixtures/docs", import.meta.url));
const content = fileURLToPath(new URL("../../content/docs", import.meta.url));
const install: Doc = { title: "Install", slug: "install", file: "install.md" };

const mermaid = [
    "```mermaid",
    "flowchart TD",
    '    a["{#not-an-id}"] -->|tool calls| b["/docs/"]',
    "    local x-.-x|cannot reach| box",
    "```",
].join("\n");

const body = [
    "# Install {#install}",
    "",
    "Read the [Terms](/terms/) and the [privacy notice](/privacy), see the",
    "[bridge](#bridge), [Paying](/docs/paying/#refunds) and [`pay`](https://pay.sh).",
    "",
    "## The bridge: `npx @bugnet/mcp` {#bridge}",
    "",
    "| Entry                  | Pays    |",
    "| ---------------------- | ------- |",
    "| The [bridge](#bridge)  | By link |",
    "",
    "Inline `[x](/docs/)` stays, as does support@bugnet.org and [ref].",
    "",
    "```sh",
    "echo '[x](/docs/) {#id}'",
    "```",
    "",
    mermaid,
    "",
    "### Limits {#limits}",
    "",
    "[ref]: /stats/#limits",
    "",
].join("\n");

describe("cleanMarkdown", () => {
    const md = cleanMarkdown(install, body);

    it("opens with the title and the page's address", () => {
        expect(md.split("\n").slice(0, 4)).toEqual([
            "# Install",
            "",
            "Source: https://bugnet.sh/docs/install/",
            "",
        ]);
        expect(cleanMarkdown(docs[0] as Doc, "# Get started {#get-started}\n\nHi.\n")).toBe(
            "# Get started\n\nSource: https://bugnet.sh/docs/\n\nHi.\n",
        );
    });

    it("drops every heading's {#id}", () => {
        expect(md).toContain("\n## The bridge: `npx @bugnet/mcp`\n");
        expect(md).toContain("\n### Limits\n");
        expect(md).not.toMatch(/^#.*\{#/m);
    });

    it("makes every link into the site absolute, and leaves the rest alone", () => {
        expect(md).toContain("[Terms](https://bugnet.sh/terms/)");
        expect(md).toContain("[privacy notice](https://bugnet.sh/privacy/)");
        expect(md).toContain("[bridge](https://bugnet.sh/docs/install/#bridge), ");
        expect(md).toContain("[Paying](https://bugnet.sh/docs/paying/#refunds)");
        expect(md).toContain("| The [bridge](https://bugnet.sh/docs/install/#bridge)  | By link |");
        expect(md).toContain("[ref]: https://bugnet.sh/stats/#limits");
        expect(md).toContain("[`pay`](https://pay.sh)");
        expect(md).toContain("Inline `[x](/docs/)` stays, as does support@bugnet.org and [ref].");
    });

    it("keeps code and Mermaid fences byte for byte", () => {
        expect(md).toContain("```sh\necho '[x](/docs/) {#id}'\n```");
        expect(md).toContain(mermaid);
    });

    it("refuses a body whose first heading is not the page's title", () => {
        expect(() => cleanMarkdown(install, "# Setup\n\nHi.\n")).toThrow(/not "Install"/);
        expect(() => cleanMarkdown(install, "Hi.\n\n# Install\n")).toThrow(/title/);
    });
});

describe("docMarkdown", () => {
    it("leaves the front matter out", () => {
        const md = docMarkdown(install, fixtures);
        expect(md).toBe(
            "# Install\n\nSource: https://bugnet.sh/docs/install/\n\nAdd it.\n\n### Claude Code\n\nRun `claude mcp add bugnet`.\n",
        );
    });

    it("serves Get started at /docs/index.md and the rest by slug", () => {
        expect(docs.map(docMarkdownPath)).toEqual([
            "/docs/index.md",
            "/docs/install.md",
            "/docs/before-you-pay.md",
            "/docs/paying.md",
            "/docs/tools.md",
            "/docs/limits.md",
            "/docs/safety.md",
            "/docs/watching-a-run.md",
            "/docs/faq.md",
        ]);
    });

    it("cleans every docs page and keeps each of its Mermaid diagrams whole", () => {
        for (const doc of docs) {
            const md = docMarkdown(doc, content);
            expect(md, doc.file).not.toMatch(/^---|\{#[\w-]+\}|\]\((?!https?:\/\/)|\]: \//m);
            const fences = readDoc(doc, content).body.match(/```mermaid\n[\s\S]*?\n```/g) ?? [];
            for (const fence of fences) expect(md, doc.file).toContain(fence);
        }
    });
});
