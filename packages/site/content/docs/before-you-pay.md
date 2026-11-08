---
title: Before you pay
---

# Before you pay

Bugnet takes USDC on Solana mainnet only, and pays the SOL fees itself. You pay each order in one
of three ways: by link in a browser wallet, from the pay.sh wallet on your computer, or from a
wallet file. Set one up before your first run.

## Three ways to pay {#three-ways-to-pay}

|                | By link                                                   | From the pay.sh wallet                                 | From a wallet file                                    |
| -------------- | --------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| You need       | A browser wallet such as Phantom or Solflare holding USDC | [`pay`](https://pay.sh) set up on this computer        | A wallet file from `bugnet-mcp key new`, holding USDC |
| You approve in | Your wallet, or Phantom or Solflare on your phone         | Touch ID, Windows Hello or polkit                      | No extra confirmation, within limits you set          |
| Clients        | Every client, claude.ai included                          | The `bugnet-wallet` plugin, the bridge, Claude Desktop | The bridge, on macOS and Linux                        |
| Setup          | None                                                      | About 5 to 10 minutes, once                            | A key, a little USDC and `mcp.toml`, once             |

## Paying by link {#paying-by-link}

You need a browser wallet, such as Phantom or Solflare, holding USDC on Solana mainnet. You can also
pay from your phone: scan the page's QR code to open it in Phantom, or open the link on your phone
in Phantom or Solflare. Nothing needs installing on your computer, so this works in every client,
claude.ai included.

## Paying from the pay.sh wallet {#paying-from-the-pay-wallet}

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

You approve each payment with Touch ID, Windows Hello or polkit.

> [!NOTE]
> A machine with no biometric or polkit prompt, such as over SSH or headless, cannot pay this way.

In Claude Code, start it as plain `claude`, never `pay claude`, which loads only pay's own server
and hides Bugnet.

## Paying from a wallet file {#paying-from-a-wallet-file}

Instead of `pay`, the [bridge](/docs/install/#bridge) can sign Bugnet orders itself from a wallet
file, with no extra confirmation, within the limits you set. It needs the bridge,
`npx -y @bugnet/mcp`, not the URL entry. The wallet file works on macOS and Linux. On Windows it
cannot be loaded yet, so every payment goes to the pay.sh wallet or the pay link.

1. Run `bugnet-mcp key new` in your own terminal. It creates `~/.config/bugnet/wallet.json` and
   prints only its address. To move a key you already have from a `.env` file instead, run this,
   then delete that line as it tells you:

    ```sh
    bugnet-mcp key import --from ./.env --var NAME
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
allowance_pay_to = ["<bugnet allowance wallet>"]
key_pays_allowances = true   # false sends allowances to pay.sh
```

Bugnet publishes its real wallet addresses at launch. Put those in place of the placeholders.

Setting `pay_signer = "key"` is your approval for the agent to spend from this wallet, within the
caps: it pays sandbox time, and by default x402 allowances too. Claude Code still asks you to
approve each paid tool call. Keep `daily_usd` low, or set `key_pays_allowances = false` to send
allowances to `pay` instead.

> [!WARNING]
> **Keep a small balance**
> Use a wallet just for this. Any process running as you can read the file.

## Refunds {#refunds}

Refunds are automatic. They go back in USDC to the token account that paid, even when it paid a
link someone else sent, so keep that account open until any refund arrives.
[Paying](/docs/paying/#refunds) lists when you get one.
