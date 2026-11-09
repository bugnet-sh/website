---
title: Get started
---

# Get started {#get-started}

Bugnet gives your AI agent a throwaway cloud Linux sandbox for work you don't want on your
computer: a repo you have not checked, an AI model, a tool your machine lacks. Your agent pays per
run in USDC on Solana. There is no account and no API key.

## 1. Install Bugnet {#install-bugnet}

Run this in a terminal to add Bugnet to Claude Code:

```sh
claude mcp add --scope user --transport http bugnet https://mcp.bugnet.sh/mcp
```

`--scope user` puts Bugnet in every project, for you only. It needs no sign-in, header or API key.
By installing Bugnet you accept the [Terms](/terms/).

Check it with `claude mcp list`. The list shows
`bugnet: https://mcp.bugnet.sh/mcp (HTTP) - ✔ Connected`.

This entry pays by link. To pay from the pay.sh wallet or a wallet file on this computer, add the
[bridge](/docs/install/#bridge) instead, which needs Node 20.19.3 or newer. Add one, not both, or every
tool shows up twice:

```sh
claude mcp add --scope user --transport stdio bugnet -- npx -y @bugnet/mcp@0.1.0
```

The [Claude Code plugin](/docs/install/#claude-code) adds a skill and hints on top of the server.
Every other client is on [Install](/docs/install/).

## 2. Get ready to pay {#get-ready-to-pay}

Bugnet takes USDC on Solana mainnet only, and pays the SOL fees itself. Set up one of three ways
to pay:

- **By link:** a browser wallet such as Phantom or Solflare.
- **From the pay.sh wallet:** on this computer, with Touch ID.
- **From a wallet file:** no extra confirmation, within limits you set.

### By link {#ready-by-link}

Nothing to set up. You need a browser wallet holding USDC, or Phantom or Solflare on your phone.

### From the pay.sh wallet {#ready-pay-sh-wallet}

You need [`pay`](https://pay.sh) on this computer, the bridge from step 1, and Touch ID, Windows
Hello or polkit to approve. It takes about 5 to 10 minutes, once:

1. Install `pay` with `brew install pay`, or with `npm i -g @solana/pay`.
2. Run `pay setup`.
3. Run `pay topup`.
4. Start Claude Code as plain `claude`, never `pay claude`, which loads only pay's own server and
   hides Bugnet.

```sh
brew install pay
pay setup
pay topup
```

> [!NOTE]
> A machine with no biometric or polkit prompt, such as over SSH or headless, cannot pay this way.

### From a wallet file {#ready-wallet-file}

The bridge signs Bugnet orders itself from a wallet file, with no extra confirmation, within the
limits you set. It needs the bridge from step 1, `npx -y @bugnet/mcp@0.1.0`, not the URL entry. It
works on macOS and Linux. On Windows, payments go to the pay.sh wallet or the pay link.

1. Run `npx -y @bugnet/mcp@0.1.0 key new` in your own terminal. It creates
   `~/.config/bugnet/wallet.json` and prints only its address. To move a key you already have from a
   `.env` file instead, run this, then delete that line as it tells you:

    ```sh
    npx -y @bugnet/mcp@0.1.0 key import --from ./.env --var NAME
    ```

2. Send that address a little USDC on Solana. It needs no SOL: Bugnet pays the fee.
3. Turn it on in `~/.config/bugnet/mcp.toml`. The bridge reads these settings only from that file,
   which must be yours and not writable by group or others.

```toml
pay_signer = "key"           # "pay", the default, uses the pay CLI
max_payment_usd = 1          # per payment: default 1, at most 20
daily_usd = 5                # per UTC day: default 5, at most 100
# Bugnet's wallets; without them the bridge signs nothing
pay_to = ["<bugnet sandbox wallet>"]
fee_payer = ["<bugnet fee payer>"]
# Bugnet's x402 allowance wallet, never a pay_to wallet
allowance_pay_to = ["<bugnet allowance wallet>"]
key_pays_allowances = true   # false sends allowances to pay.sh
```

Bugnet publishes its real wallet addresses at launch. Put those in place of the placeholders.
The daily cap counts every bridge on this computer together.
Claude Code still asks you to approve each paid tool call.

> [!WARNING]
> **Keep a small balance**
> Use a wallet just for this. Any process running as you can read the file.

Refunds go back automatically to the USDC token account that paid, so keep it open.
[Before you pay](/docs/before-you-pay/) compares the three ways.

## 3. Ask your agent {#ask-your-agent}

![Ask for a sandbox](/docs/clips/ask.mp4)

```mermaid
sequenceDiagram
    participant You
    participant Agent
    participant Bugnet
    participant Sandbox
    You->>Agent: Try this repo
    Agent->>Bugnet: bugnet_assess
    Bugnet-->>Agent: findings, price
    Agent->>You: findings, price
    You->>Agent: approve
    Agent->>Bugnet: bugnet_start
    Bugnet-->>Agent: pay link, claim
    You->>Bugnet: pay in USDC
    Agent->>Bugnet: bugnet_redeem
    Bugnet->>Sandbox: start
    Agent->>Bugnet: bugnet_exec, files
    Bugnet->>Sandbox: run, read, write
    Agent->>Bugnet: bugnet_stop
    Bugnet->>Sandbox: delete
```

Ask in your own words. For example:

> Try https://github.com/someone/some-tool for me, I don't trust it.

Or "get this text to speech model running". Your agent learns from Bugnet's server instructions
when a sandbox fits: AI models, code you have not checked, tools your machine lacks. It offers a
sandbox once, never for work on your own project, and does not ask again for a task once you say
no.

## 4. The free check {#the-free-check}

Your agent calls `bugnet_assess`, which is free. It checks the repo, model or script against fixed
rules:

- the repo's age and stars;
- install scripts that download or run binaries;
- hidden code;
- model files that can run code when loaded;
- whether your machine has the memory or GPU the work needs.

`bugnet_assess` returns short findings, never the files it read, and a price for the sandbox sizes
that fit. `bugnet_quote` gives the prices without the check.

The agent tells you in a sentence or two what it found and the price, for example that the repo is
3 days old and its installer downloads a binary. Then it waits for your answer. Nothing is paid
yet, and the quote is valid for 10 minutes.

## 5. Approve the price {#approve-the-price}

1. Say yes to the agent.
2. Read the price in Claude Code's approval prompt for `bugnet_start`.
3. Approve the call.

The agent calls `bugnet_start` with `confirmPriceUsd`, the price it told you, so the price is in the
prompt. Bugnet refuses the call, before any order exists, if that price is not the exact price of
the size the agent picked. Approving means "yes, pay this exact amount for this sandbox".

Claude Code asks before every `bugnet_start`, even in modes that skip other prompts, and refuses the
call when there is no person to ask.

Bugnet answers with a payment step: an order, its pay link on `pay.bugnet.sh`, and a claim that
lets your agent use the order once it is paid.

## 6. Pay {#pay}

The amount is the price you approved. An unpaid order expires after 15 minutes, and nothing is
charged.

### By link {#pay-by-link}

1. Open the pay link the agent shows you, `https://pay.bugnet.sh/o/<order>`.
2. Pay with your browser wallet, or scan the page's QR code to open it in Phantom on your phone.
3. Tell your agent you paid.

### From the pay.sh wallet {#pay-from-the-wallet}

1. Approve the payment with Touch ID when `pay` asks.

![Approve and pay with Touch ID](/docs/clips/pay.mp4)

### From a wallet file {#pay-from-a-wallet-file}

Nothing more to approve. The bridge pays from the wallet file, within your caps.

The bridge pays only links on `pay.bugnet.sh`, only on Solana mainnet, and never more than the price
you approved. A payment over your caps is not signed, and you get the pay link instead. If neither
way is set up, the bridge opens the pay link in your client when the client can open links, and
waits up to 10 minutes for you to pay there.

## 7. The sandbox starts {#the-sandbox-starts}

After a link payment, your agent calls `bugnet_redeem` with the order and its claim. When the bridge
pays, from the pay.sh wallet or a wallet file, it finishes the order itself. `bugnet_redeem` is free
and asks for no approval, because your wallet signature was the payment approval.

Bugnet starts a fresh sandbox, and your agent gets two things:

- **The handle**, which starts with `sbx_`. It is the only key to your sandbox, so keep it private.
- **The session page link**, with the line "After this sandbox ends, its summary and logs stay at
  `<url>` for 48 hours", and an instruction to show you the link.

Paid time starts when the sandbox is ready, not when you pay. `bugnet_status` shows the state and
the time left.

## 8. Run commands {#run-commands}

1. Ask for the work, such as "install it and run the tests".

![Run in the sandbox](/docs/clips/run.mp4)

The agent runs each shell command with `bugnet_exec`, which returns the exit code and the last 8 KiB
of the output and of the errors. The agent reads the results and tells you what happened.

- Every tool call answers within 45 seconds. A longer command keeps running, and the agent follows
  it with `bugnet_job`.
- `bugnet_cancel_job` stops a running command.
- The sandbox runs Linux. Windows and macOS programs can be inspected there but not run.
- Bugnet strips terminal escape codes, hidden control characters and text direction tricks from the
  output, and labels it as data, not instructions.

## 9. Move files in and out {#move-files-in-and-out}

| To                        | Your agent calls    | Size per call |
| ------------------------- | ------------------- | ------------- |
| Read a file               | `bugnet_read_file`  | Up to 256 KiB |
| Write a file              | `bugnet_write_file` | Up to 256 KiB |
| Move a big file in or out | `bugnet_transfer`   | Any size      |

`bugnet_list_files` lists a folder. `bugnet_transfer` makes a one-use `curl` link, valid for 10
minutes, that checks the file's SHA-256 both ways. Claude Code asks you before each transfer, since
it moves a file between your computer and the sandbox. Downloads go to `./bugnet-downloads/` unless
you name another file, and never overwrite a file you have.

> [!WARNING]
> Download what you need before the deadline. Then the sandbox and everything in it are deleted.

## 10. Watch the run {#watch-the-run}

1. Open the session page link the agent showed you.

![Session summary](/docs/clips/summary.mp4)

While the sandbox runs, the page shows its output live. After it ends, the page shows:

- a map of the calls Bugnet saw, with Bugnet's own payments, their amounts and transaction
  signatures linked to an explorer;
- each command's output and errors, with exit codes;
- the start time, the end time and why it ended.

The page is read-only, and anyone with the full link can read it.
[Watching a run](/docs/watching-a-run/) has the rest.

## 11. Add time {#add-time}

1. Ask the agent for more time.
2. Approve the `bugnet_extend` prompt.
3. Pay the same way as in step 6.

`bugnet_status` shows the time left and what more time costs. `bugnet_extend` is paid and asks you
every time, like `bugnet_start`. After a link payment the agent finishes it with `bugnet_redeem`.
Extend before the deadline: an ended sandbox cannot get more time.

## 12. Stop {#stop}

1. Download what you need.
2. Tell the agent you are done.

![Stop the sandbox](/docs/clips/stop.mp4)

The agent calls `bugnet_stop`, which deletes the sandbox and everything in it at once. Its answer
carries the session link again, with the time the page is deleted: "Summary and logs: `<url>`
(until `<time>`)".

If nothing stops it, the sandbox and everything in it are deleted at the deadline. Unused time is
not refunded when you stop early.

## 13. If something goes wrong {#if-something-goes-wrong}

| What happened                                     | What follows                                    |
| ------------------------------------------------- | ----------------------------------------------- |
| The price in the call is not the exact price      | Bugnet refuses the call. Nothing is charged     |
| The quote is older than 10 minutes                | Bugnet refuses the start. A new quote is free   |
| Bugnet cannot reach its payment service           | The tool fails, and nothing starts              |
| You never pay the order                           | It expires after 15 minutes. Nothing is charged |
| You pay at the link and from a wallet too         | You are charged once                            |
| Your payment lands after the order expired        | It is refunded                                  |
| You paid, but no sandbox starts within 30 minutes | The order is refunded                           |
| The sandbox fails before it is ready              | The whole payment is refunded                   |
| You paid for more time, but Bugnet refused it     | It is refunded                                  |
| The sandbox already ended                         | Every tool says so and gives the session link   |
| You stop early, or the deadline passes            | Unused time is not refunded                     |

Refunds are automatic and go back to the USDC token account that paid. The full list is in the
[Terms](/terms/#refunds).

At the end you have the results in your chat, the files you downloaded, and the session page for
48 hours. The sandbox and everything in it are gone.

## Next steps {#next-steps}

- [Install](/docs/install/): Add Bugnet to claude.ai, Cursor, VS Code, Codex CLI and more.
- [Before you pay](/docs/before-you-pay/): Compare the three ways to pay and set one up.
- [Tools](/docs/tools/): What each tool does, what it costs and which ones ask you.
- [Safety](/docs/safety/): What the sandbox can reach and what Bugnet can see.
