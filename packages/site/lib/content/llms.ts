import { installLines } from "../landing/install-lines";
import { readDoc } from "./doc-file";
import { docMarkdown, docMarkdownPath, siteOrigin } from "./doc-markdown";
import { docBySlug, docs, type Doc } from "./docs";

/** What each page covers, one line each, as llms.txt lists it. */
const summaries: Record<string, string> = {
    "": "Install Bugnet, pay for a sandbox and run your first commands, step by step.",
    install:
        "Add the MCP server to Claude Code, claude.ai, Claude Desktop, Cursor, VS Code, Codex CLI, Devin Desktop or any MCP client.",
    "before-you-pay":
        "The two ways to pay, by link in a browser wallet or from the pay wallet, and how to set each up.",
    paying: "How a run is paid with x402 in USDC on Solana: the approval prompt, prices and refunds.",
    tools: "Every tool your agent gets, what it does, what it costs and which ones ask you first.",
    limits: "Time limits, output and file sizes, call rates, and what Bugnet will not run.",
    safety: "What the sandbox can reach, how its output is cleaned, and what Bugnet can and cannot see.",
    "watching-a-run":
        "Following a run in the chat and on its session page, and how the page's link works.",
    faq: "Short answers on accounts, costs, wallets, refunds, files, CI and the source code.",
};

const url = (path: string) => `${siteOrigin}${path}`;

function summary(doc: Doc): string {
    const line = summaries[doc.slug];
    if (!line) throw new Error(`llms.txt has no summary for ${doc.file}`);
    return line;
}

/** The site's index for language models, as llmstxt.org lays it out. */
export function llmsTxt(dir?: string): string {
    const install = docBySlug("install") as Doc;
    const { hero } = installLines(readDoc(install, dir).body);
    return [
        "# Bugnet",
        "",
        "> Throwaway cloud Linux sandboxes for AI agents, paid per run in USDC on Solana, with no account and no API key.",
        "",
        "Bugnet is one MCP server at https://mcp.bugnet.sh/mcp. Add it to Claude Code with:",
        "",
        "```sh",
        hero,
        "```",
        "",
        `[Install](${url(docMarkdownPath(install))}) has every other client.`,
        "",
        "## Docs",
        "",
        ...docs.map((doc) => `- [${doc.title}](${url(docMarkdownPath(doc))}): ${summary(doc)}`),
        "",
        "## Optional",
        "",
        `- [All docs](${url("/llms-full.txt")}): every page above in one file`,
        `- [Terms](${url("/terms/")}): the terms of service and acceptable use`,
        `- [Privacy](${url("/privacy/")}): what data Bugnet handles and why`,
        "",
    ].join("\n");
}

/** Every docs page's Markdown, in the sidebar's order. */
export function llmsFullTxt(dir?: string): string {
    return docs.map((doc) => docMarkdown(doc, dir)).join("\n");
}

/** Each file the build writes into `public/`, by the path it is served at. */
export function llmsFiles(dir?: string): Map<string, string> {
    return new Map([
        ["/llms.txt", llmsTxt(dir)],
        ["/llms-full.txt", llmsFullTxt(dir)],
        ...docs.map((doc): [string, string] => [docMarkdownPath(doc), docMarkdown(doc, dir)]),
    ]);
}
