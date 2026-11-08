---
title: Tools
---

# Tools

Your agent calls these tools on Bugnet's MCP server. Two cost money, `bugnet_start` and
`bugnet_extend`. Everything else is free.

| Tool                | What it does                                                            | Cost | Asks you |
| ------------------- | ----------------------------------------------------------------------- | ---- | -------- |
| `bugnet_assess`     | Checks a repo, model or script and says if a sandbox fits, and why      | Free | No       |
| `bugnet_quote`      | Prices the sandbox sizes that fit the work                              | Free | No       |
| `bugnet_start`      | Pays for a sandbox and starts it                                        | Paid | Always   |
| `bugnet_redeem`     | Finishes an order paid at its pay link: starts the sandbox or adds time | Free | No       |
| `bugnet_status`     | Shows the state, time left and extension prices                         | Free | No       |
| `bugnet_exec`       | Runs a shell command and returns its exit code and last output          | Free | No       |
| `bugnet_job`        | Follows a command that is still running                                 | Free | No       |
| `bugnet_cancel_job` | Stops a running command                                                 | Free | No       |
| `bugnet_list_files` | Lists a folder                                                          | Free | No       |
| `bugnet_read_file`  | Reads up to 256 KiB of a file per call                                  | Free | No       |
| `bugnet_write_file` | Writes a file of up to 256 KiB                                          | Free | No       |
| `bugnet_transfer`   | Makes a one-use `curl` link to move a big file in or out                | Free | Always   |
| `bugnet_extend`     | Pays for more time                                                      | Paid | Always   |
| `bugnet_stop`       | Deletes the sandbox and everything in it                                | Free | No       |

"Always" means the tool is marked for a person's approval. Claude Code asks before every call to
it, even in modes that skip other prompts, and refuses the call when there is no person to ask.
Other clients ask according to their own tool approval settings, so keep approval on for these
three tools.

With the Claude Code plugin, the tools show up as `mcp__plugin_bugnet_sandbox__bugnet_*`, or
`mcp__plugin_bugnet-wallet_sandbox__bugnet_*` with the wallet plugin.

## A sandbox's life {#a-sandboxs-life}

```mermaid
stateDiagram-v2
    [*] --> Quoted: assess or quote
    Quoted --> Unpaid: bugnet_start
    Unpaid --> Expired: 15 min unpaid
    Unpaid --> Paid: you pay
    Paid --> Refunded: unused 30 min
    Paid --> Starting: bugnet_redeem
    Starting --> Refunded: fails to start
    Starting --> Running: ready
    Running --> Deleted: bugnet_stop or deadline
    Deleted --> [*]
```

1. **Quoted.** `bugnet_assess` or `bugnet_quote` gives a price, valid for 10 minutes.
2. **Unpaid.** `bugnet_start` makes an order with a pay link. It expires after 15 minutes, and
   nothing is charged.
3. **Paid.** You paid the order. If no sandbox starts from it within 30 minutes, it is refunded.
4. **Starting.** `bugnet_redeem`, or the bridge after a `pay` payment, starts the sandbox. A sandbox
   that fails before it is ready is refunded in full.
5. **Running.** Paid time starts when the sandbox is ready. `bugnet_extend` adds time, paid as a new
   order.
6. **Deleted.** `bugnet_stop` or the deadline deletes the sandbox and everything in it. The session
   page stays for 48 hours.

## Checking {#checking}

`bugnet_assess` checks a repo, model or script against fixed rules and says whether a sandbox fits,
and why:

- the repo's age and stars;
- install scripts that download or run binaries;
- hidden code;
- model files that can run code when loaded;
- whether your machine has the memory or GPU the work needs.

It returns short findings and a price, never the files it read. `bugnet_quote` prices the sandbox
sizes that fit the work. Both are free and allow 12 calls a minute per IP address together, in
bursts of up to 10.

## Starting and paying {#starting-and-paying}

- `bugnet_start` takes `confirmPriceUsd`, the price your agent told you, and refuses any other
  price. It answers with a payment step, or, once paid, with the started sandbox.
- `bugnet_redeem` takes the order and its claim after a link payment. For more time it also takes
  the sandbox's handle.
- `bugnet_extend` buys more time at the prices `bugnet_status` shows, paid the same way as a start.

[Paying](/docs/paying/) has the whole flow.

## Running commands {#running-commands}

- `bugnet_exec` runs a command line with `sh -c`, or a list of arguments, with an optional time
  limit. It returns the exit code and the last 8 KiB of the output and of the errors.
- `bugnet_exec` refuses environment values shaped like API tokens.
- Every tool call answers within 45 seconds. A longer command keeps running, and `bugnet_job`
  follows it from where the last answer stopped.
- `bugnet_cancel_job` stops a running command.

Bugnet strips terminal escape codes, hidden control characters and text direction tricks from the
output, and labels it as data, not instructions.

## Files {#files}

- `bugnet_list_files` lists a folder.
- `bugnet_read_file` reads up to 256 KiB of a file per call, as text or base64.
- `bugnet_write_file` writes a file of up to 256 KiB, as text or base64.
- `bugnet_transfer` makes a one-use `curl` link for a file of any size, in or out, valid for 10
  minutes. It checks the file's SHA-256 both ways. Downloads go to `./bugnet-downloads/` unless you
  name another file, and never overwrite a file you have.

## Status and stopping {#status-and-stopping}

- `bugnet_status` shows the state, the time left and what more time costs. On an ended sandbox it
  gives the session page link.
- `bugnet_stop` deletes the sandbox and everything in it at once, and gives the session page link
  with the time the page is deleted.
- Any tool called on an ended sandbox says so and gives the session page link.
