import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { readDoc } from "../content/doc-file";
import { docBySlug, type Doc } from "../content/docs";
import { clients } from "./clients";
import { installLines } from "./install-lines";

const dir = fileURLToPath(new URL("../../content/docs", import.meta.url));
const lines = installLines(readDoc(docBySlug("") as Doc, dir).body);

it("takes each client's first code block from the docs, or its steps when it has none", () => {
    expect(lines.clients.map((c) => c.id)).toEqual(clients.map((c) => c.id));
    expect(lines.clients[0]).toEqual({
        id: "claude-code",
        name: "Claude Code",
        code: expect.stringMatching(/^claude plugin marketplace add bugnet-sh\/bugnet\n/),
        lang: "sh",
    });
    expect(lines.clients.find((c) => c.id === "claude-ai")).toEqual({
        id: "claude-ai",
        name: "claude.ai",
        steps: expect.stringMatching(/^1\. Open \*\*Customize > Connectors\*\*\./),
    });
    expect(lines.hero).toBe("claude mcp add --transport http bugnet https://mcp.bugnet.sh/mcp");
});

it("fails the build when a client has no section", () => {
    expect(() => installLines("### Cursor {#cursor}\n\n```json\n{}\n```\n")).toThrow(/claude-code/);
});
