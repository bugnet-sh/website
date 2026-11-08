---
title: Install
sources:
    - bugnet-gateway/README.md: Install
    - docs/website/plan.md: section 2, /docs#install
    - content/legal/terms.md: Accepting these terms
---

# Install {#install}

Bugnet is one MCP server at `https://mcp.bugnet.sh/mcp`. It speaks Streamable HTTP and needs no
sign-in, header or API key. By installing Bugnet you accept the [Terms](/terms/).

## Clients

### Claude Code {#claude-code}

#### The plugin

The plugin adds the MCP server, a skill that tells Claude when a sandbox fits, and hint hooks. It
comes in two forms. Install one, not both, or every tool shows up twice.

```sh
claude plugin marketplace add bugnet-sh/bugnet
claude plugin install bugnet@bugnet          # pays by link, in your browser
claude plugin install bugnet-wallet@bugnet   # pays from the pay wallet on this computer
```

- `bugnet` connects to `https://mcp.bugnet.sh/mcp` and needs nothing else.
- `bugnet-wallet` runs the [bridge](#bridge) with `npx`, so it needs Node 20.3 or newer, and pays
  with [`pay`](https://pay.sh) set up on this computer.
- Start Claude Code as plain `claude`, never `pay claude`, which loads only pay's own server and
  hides Bugnet.

Inside a session, `/plugin marketplace add bugnet-sh/bugnet` and then
`/plugin install bugnet@bugnet` do the same. Start a new session afterwards. The tools show up as
`mcp__plugin_bugnet_sandbox__bugnet_*`, or `mcp__plugin_bugnet-wallet_sandbox__bugnet_*` with the
wallet plugin.

The hooks run a small local script with Node and stay silent if Node is not installed. They add a
short hint when a prompt or a command looks like a fit, for example after a local run fails for
lack of CUDA, memory or disk space. Set `BUGNET_HINTS=quiet` to keep only hints after failed
commands, or `BUGNET_HINTS=off` to turn hints off.

#### Just the MCP server

```sh
claude mcp add --transport http bugnet https://mcp.bugnet.sh/mcp
```

That adds Bugnet to the current project for you only. Add `--scope user` to have it in every
project, or `--scope project` to share it with your team through `.mcp.json`. Check it with
`claude mcp list`, which should show `bugnet: https://mcp.bugnet.sh/mcp (HTTP) - ✔ Connected`.

### claude.ai {#claude-ai}

1. Open **Customize > Connectors**.
2. Click **+ Add**, then **Add custom connector**.
3. Name it `Bugnet` and enter `https://mcp.bugnet.sh/mcp` as the URL. Click **Continue**, and
   **Continue** again on the detected settings.
4. Under **Authentication**, choose **No sign in**. Click **Add**.
5. In a chat, click **+** at the lower left, then **Connectors**, and turn Bugnet on.

On Team and Enterprise plans an owner adds it first under **Organization settings > Connectors**,
then each member connects it. The Free plan allows one custom connector.

claude.ai pays by link: the agent shows you the order's pay link, you pay in your browser, and the
agent finishes the order with `bugnet_redeem`.

### Cursor {#cursor}

Add this to `.cursor/mcp.json` in your project, or to `~/.cursor/mcp.json` for every project:

```json
{
    "mcpServers": {
        "bugnet": {
            "url": "https://mcp.bugnet.sh/mcp"
        }
    }
}
```

To pay from the [`pay`](https://pay.sh) wallet on this computer, use the bridge entry instead of
the URL one:

```json
{
    "mcpServers": {
        "bugnet": { "command": "npx", "args": ["-y", "@bugnet/mcp@0.1.0"] }
    }
}
```

Cursor's docs do not say it reads MCP server instructions, so copy
[`integrations/cursor/bugnet.mdc`](https://github.com/bugnet-sh/bugnet/blob/main/integrations/cursor/bugnet.mdc)
to `.cursor/rules/bugnet.mdc` too. It tells the agent when to offer a sandbox.

### VS Code {#vs-code}

Add this to `.vscode/mcp.json` in your workspace:

```json
{
    "servers": {
        "bugnet": {
            "type": "http",
            "url": "https://mcp.bugnet.sh/mcp"
        }
    }
}
```

Or run **MCP: Add Server** from the Command Palette, pick **HTTP**, and enter the URL. To add it
to your user profile from a terminal:

```sh
code --add-mcp '{"name":"bugnet","type":"http","url":"https://mcp.bugnet.sh/mcp"}'
```

To pay from the [`pay`](https://pay.sh) wallet on this computer, use the bridge entry instead of
the URL one:

```json
{
    "servers": {
        "bugnet": { "type": "stdio", "command": "npx", "args": ["-y", "@bugnet/mcp@0.1.0"] }
    }
}
```

### Codex CLI {#codex-cli}

To pay from the [`pay`](https://pay.sh) wallet on this computer, add the bridge:

```sh
codex mcp add bugnet -- npx -y @bugnet/mcp@0.1.0
```

Then give it more time in `~/.codex/config.toml`, since a paid call waits while you approve the
payment and the first start downloads the bridge:

```toml
[mcp_servers.bugnet]
command = "npx"
args = ["-y", "@bugnet/mcp@0.1.0"]
startup_timeout_sec = 30
tool_timeout_sec = 400
```

To pay by link in your browser instead, add the URL:

```sh
codex mcp add bugnet --url https://mcp.bugnet.sh/mcp
```

Or add it to `~/.codex/config.toml` yourself:

```toml
[mcp_servers.bugnet]
url = "https://mcp.bugnet.sh/mcp"
```

`codex mcp list` shows it, and so does `/mcp` inside Codex. Through the URL every Bugnet tool
answers within 45 seconds, inside Codex's default 60 second limit.

### Devin Desktop {#devin-desktop}

Devin Desktop was formerly Windsurf. Add this to `~/.config/devin/mcp_config.json`, or to
`.devin/mcp_config.json` in your project:

```json
{
    "mcpServers": {
        "bugnet": {
            "url": "https://mcp.bugnet.sh/mcp"
        }
    }
}
```

Then open **Customize**, click **MCPs**, and refresh the list. An older Windsurf takes the same
entry in the file that Cascade's **Open MCP config file** opens.

### Any MCP client {#any-mcp-client}

| Setting   | Value                                       |
| --------- | ------------------------------------------- |
| URL       | `https://mcp.bugnet.sh/mcp`                 |
| Transport | Streamable HTTP                             |
| Sign-in   | None, no headers and no API key             |
| Stdio     | `npx -y @bugnet/mcp@0.1.0`, needs Node 20.3 |

Most clients take one of these two shapes. The second runs the [bridge](#bridge).

```json
{
    "mcpServers": {
        "bugnet": { "url": "https://mcp.bugnet.sh/mcp" }
    }
}
```

```json
{
    "mcpServers": {
        "bugnet": { "command": "npx", "args": ["-y", "@bugnet/mcp@0.1.0"] }
    }
}
```

If your agent reads `AGENTS.md`, paste
[`integrations/agents-md/AGENTS.snippet.md`](https://github.com/bugnet-sh/bugnet/blob/main/integrations/agents-md/AGENTS.snippet.md)
into it.

### The bridge: `npx @bugnet/mcp` {#bridge}

The bridge is a small program that runs on your computer. Your client talks to it over stdio, and
it passes every call on to Bugnet's server unchanged, except that it pays or opens the pay link
for a payment step. You only need it for these:

- **Paying from the `pay` wallet on your computer.** When a paid call needs a payment, the bridge
  has [`pay`](https://pay.sh) pay it after you approve with Touch ID, then finishes the order. It
  pays only links on `pay.bugnet.sh`, on Solana mainnet, up to the price you approved.
- **Clients that only run local servers.**

Use the bridge instead of the URL, not both, or every tool shows up twice. It needs Node 20.3 or
newer.

| Client      | Setup                                                                                  |
| ----------- | -------------------------------------------------------------------------------------- |
| Claude Code | `claude mcp add --transport stdio bugnet -- npx -y @bugnet/mcp@0.1.0`                  |
| Codex CLI   | `codex mcp add bugnet -- npx -y @bugnet/mcp@0.1.0`                                     |
| Cursor      | `"bugnet": { "command": "npx", "args": ["-y", "@bugnet/mcp@0.1.0"] }`                  |
| Devin       | `"bugnet": { "command": "npx", "args": ["-y", "@bugnet/mcp@0.1.0"] }`                  |
| VS Code     | `"bugnet": { "type": "stdio", "command": "npx", "args": ["-y", "@bugnet/mcp@0.1.0"] }` |

The bridge reads `~/.config/bugnet/mcp.toml` if it exists, or the file `--config` names.
`--gateway URL` points it at another server. The settings file holds no secrets. Every setting
with its default is in
[`packages/bridge/config/example.toml`](https://github.com/bugnet-sh/bugnet/blob/main/packages/bridge/config/example.toml).
