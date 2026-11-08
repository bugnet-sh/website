---
title: Before you pay
sources:
    - docs/website/plan.md: section 1, payment; section 2, /docs#before-you-pay
    - bugnet-gateway/README.md: Paying
---

# Before you pay

Bugnet takes USDC on Solana mainnet only. Bugnet pays the SOL fees.

## Paying by link

You need a browser wallet, such as Phantom or Solflare, holding USDC. You can also scan the pay
link's Solana Pay QR code with your phone. This works in every client, claude.ai included.

## Paying from the `pay` wallet

The `bugnet-wallet` plugin and the [bridge](/docs/#bridge) pay with [`pay`](https://pay.sh) on
your computer. Setting it up takes about 5 to 10 minutes, once:

```sh
brew install pay
pay setup
pay topup
```

`npm i -g @solana/pay` installs it too. You approve each payment with Touch ID, Windows Hello or
polkit. A machine with no biometric or polkit prompt, such as over SSH or headless, cannot pay
this way.

## Refunds

Refunds are automatic and go back to your USDC token account, so keep it open.
