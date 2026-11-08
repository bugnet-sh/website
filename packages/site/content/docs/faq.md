---
title: FAQ
---

# FAQ

## Do I need an account or an API key?

No. You pay per run in USDC on Solana, at the order's pay link or from the `pay` wallet on your
computer.

## Does Bugnet use AI or read my code?

No AI runs on Bugnet's side. Bugnet sees only what your agent sends to the sandbox, as
[Safety](/docs/safety/#what-bugnet-can-and-cannot-see) lists.

## Which agents work?

Any MCP client that speaks Streamable HTTP, and any that runs local stdio servers through the
[bridge](/docs/install/#bridge). [Install](/docs/install/) has the setup for each.

## Will my agent offer Bugnet for everything?

No. Bugnet tells your agent to offer a sandbox once, for things like AI models, code you have not
checked, or tools your machine lacks. It tells it not to offer one for work on your own project,
and not to ask again for a task once you say no.

## What does a run cost?

You see the price before you pay, and you pay exactly that price. See
[Prices](/docs/paying/#prices).

## Which wallets can pay?

Any Solana wallet holding USDC can pay a pay link in a browser, such as Phantom or Solflare. On your
phone, scan the page's QR code to open it in Phantom, or open the link in Phantom or Solflare. The
`pay` wallet pays from your computer. See [Before you pay](/docs/before-you-pay/).

## Can I be charged twice for one order?

No. A paid order is never asked for again, and a second payment for it is never sent to Solana.
See [Never charged twice](/docs/paying/#never-charged-twice).

## What if the sandbox never starts?

A paid order that starts no sandbox within 30 minutes is refunded, and a sandbox that fails before
it is ready is refunded in full. See [Refunds](/docs/paying/#refunds).

## How do I get files out?

Your agent reads small files with `bugnet_read_file`, up to 256 KiB per call. For big ones,
`bugnet_transfer` gives a one-use `curl` link. Downloads go to `./bugnet-downloads/` unless you
name another file.

## Can I run it in CI?

Free tools, yes. In Claude Code, paid tools need a person to approve them, so an unattended run
cannot start a sandbox.

## How do I turn off the plugin's hints?

Set `BUGNET_HINTS=off`, or `BUGNET_HINTS=quiet` to keep only hints after a failed command.

## Is it open source?

Yes. The [repository](https://github.com/bugnet-sh/bugnet) holds the MCP server, the bridge and
the Claude Code plugin.

## Where do I report a bug?

[Open an issue](https://github.com/bugnet-sh/bugnet/issues/new/choose). Report security problems
privately, as [SECURITY.md](https://github.com/bugnet-sh/bugnet/blob/main/SECURITY.md) says.

## Can I help?

Yes, see [CONTRIBUTING.md](https://github.com/bugnet-sh/bugnet/blob/main/CONTRIBUTING.md).
