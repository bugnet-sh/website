---
title: Before you pay
sources:
    - docs/website/plan.md: section 1, payment; section 2, /docs#before-you-pay
    - bugnet-gateway/README.md: Install; Paying
    - content/legal/terms.md: Who pays; Refunds
---

# Before you pay

Bugnet takes USDC on Solana mainnet only, and pays the SOL fees itself. You pay each order in one
of two ways: by link in a browser wallet, or from the `pay` wallet on your computer. Set one up
before your first run.

## Two ways to pay {#two-ways-to-pay}

|                | By link                                                   | From the `pay` wallet                                  |
| -------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| You need       | A browser wallet such as Phantom or Solflare holding USDC | [`pay`](https://pay.sh) set up on this computer        |
| You approve in | Your wallet, or your phone through the Solana Pay QR code | Touch ID, Windows Hello or polkit                      |
| Clients        | Every client, claude.ai included                          | The `bugnet-wallet` plugin, the bridge, Claude Desktop |
| Setup          | None                                                      | About 5 to 10 minutes, once                            |

## Paying by link {#paying-by-link}

You need a browser wallet, such as Phantom or Solflare, holding USDC on Solana mainnet. You can
also scan the pay link's Solana Pay QR code with a wallet on your phone. Nothing needs installing
on your computer, so this works in every client, claude.ai included.

## Paying from the `pay` wallet {#paying-from-the-pay-wallet}

The `bugnet-wallet` plugin, the [bridge](/docs/install/#bridge) and Claude Desktop pay with
[`pay`](https://pay.sh) on your computer. Setting it up takes about 5 to 10 minutes, once:

1. Install `pay` with `brew install pay`, or with `npm i -g @solana/pay`.
2. Run `pay setup`.
3. Run `pay topup`.
4. Add Bugnet through the `bugnet-wallet` plugin or the bridge, as [Install](/docs/install/)
   shows.

```sh
brew install pay
pay setup
pay topup
```

You approve each payment with Touch ID, Windows Hello or polkit. A machine with no biometric or
polkit prompt, such as over SSH or headless, cannot pay this way.

In Claude Code, start it as plain `claude`, never `pay claude`, which loads only pay's own server
and hides Bugnet.

## Refunds {#refunds}

Refunds are automatic. They go back in USDC to the token account that paid, even when it paid a
link someone else sent, so keep that account open until any refund arrives.
[Paying](/docs/paying/#refunds) lists when you get one.
