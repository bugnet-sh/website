/** The clients in the gateway README's install order, each id an Install section in the docs. */
export const clients = [
    { name: "Claude Code", id: "claude-code" },
    { name: "claude.ai", id: "claude-ai" },
    { name: "Cursor", id: "cursor" },
    { name: "VS Code", id: "vs-code" },
    { name: "Codex CLI", id: "codex-cli" },
    { name: "Devin Desktop", id: "devin-desktop" },
    { name: "Any MCP client", id: "any-mcp-client" },
] as const;

export type ClientId = (typeof clients)[number]["id"];
