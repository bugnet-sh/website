---
title: Paying
sources:
    - bugnet-gateway/README.md: Paying
    - docs/website/plan.md: section 1, pages; section 2, /docs#paying
---

# Paying

Bugnet uses [x402](https://www.x402.org), an open standard for paying over HTTP. There is no
account to create and no API key to keep. You pay per run in USDC on Solana.

## Steps

1. Your agent calls `bugnet_start` with the price it told you, and you approve the call.
2. Bugnet answers with a payment step: an order, its pay link on `pay.bugnet.sh`, and a claim
   that lets your agent use the order once it is paid.
3. You pay the order, by link or from the `pay` wallet.
4. Your agent calls the free `bugnet_redeem` with the order and its claim, and Bugnet starts the
   sandbox. `bugnet_redeem` asks for no approval, because your wallet signature was the payment
   approval.

More time with `bugnet_extend` is paid the same way.

## Paying by link

The agent shows you the pay link. Open it and pay with a browser wallet, or scan its Solana Pay QR
code with your phone, then tell your agent you paid. This works in every client, claude.ai
included.

## Paying from the `pay` wallet

With the `bugnet-wallet` plugin or the [bridge](/docs/#bridge), the bridge pays the order with
[`pay`](https://pay.sh) on your computer, and you approve each payment with Touch ID. It pays only
links on `pay.bugnet.sh`, only on Solana mainnet, and never more than the price you approved. The
result: one approval click plus Touch ID.

Without `pay`, the bridge opens the pay link in your client when the client can open links, and
waits up to 10 minutes for you to pay.

## The approval click

`bugnet_start` and `bugnet_extend` are marked as tools a person must approve. Claude Code asks you
before every call, even in modes that skip other prompts, and refuses the call when there is no
person to ask.

The call carries `confirmPriceUsd`, the price your agent told you, so you see it in the prompt.
Bugnet refuses the call if that price is not the exact price of the size you picked. So approving
means "yes, pay this exact amount for this sandbox".

Other clients ask according to their own tool approval settings, so keep approval on for these two
tools.

## Prices

A sandbox comes in fixed sizes: CPU, memory, disk and minutes. Each has a fixed price in USDC.
`bugnet_assess` and `bugnet_quote` show the prices for free before anything is paid, and
`bugnet_status` shows what more time costs. A small sandbox for ten minutes costs a few cents. The
current sizes and prices are on the [stats page](/stats/#limits).

Stopping early does not refund the unused time.

## Unpaid and unused orders

An unpaid order expires after 15 minutes, and nothing is charged. A paid order that starts no
sandbox within 30 minutes is refunded.

## Where you pay

`pay.bugnet.sh` is the only place you ever pay. Bugnet's hosts:

| Host                 | What it is           |
| -------------------- | -------------------- |
| `bugnet.sh`          | The website and docs |
| `mcp.bugnet.sh`      | The MCP server       |
| `pay.bugnet.sh`      | Checkout             |
| `sessions.bugnet.sh` | Session pages        |
