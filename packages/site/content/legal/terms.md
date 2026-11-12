Last updated: 12 November 2026

# Bugnet Terms of Service and Acceptable Use {#terms}

These terms cover Bugnet: the Bugnet MCP server, the `bugnet` and `bugnet-wallet` plugins, the checkout at `pay.bugnet.sh`, and every sandbox you pay for. How we handle personal data is in the [Privacy Notice](/privacy).

## The short version {#summary}

- Bugnet is a hackathon project. It rents your AI agent a temporary cloud sandbox on another company's servers, paid per run in USDC on Solana.
- Installing or connecting Bugnet means you accept these terms.
- You see the exact price first and approve every payment.
- Your `sbx_` handle is the key to your sandbox. Keep it private.
- Everything in the sandbox is deleted at the deadline. Download what you need first. A summary and the logs stay on your [session page](#session-page) for 48 hours, unless you delete them.
- Refunds are automatic in the cases listed under [Refunds](#refunds).
- Your code runs with root rights. You are responsible for everything it does.
- No mining, attacks, scanning, spam, malware, phishing, proxies or illegal content. Break the rules and we end your sandbox, keep the payment and block your wallet.
- Bugnet comes as is, with no warranty.

## Who we are {#who-we-are}

"Bugnet", "we" and "us" mean Bugnet, a hackathon project. It is not a company. "You" means whoever installs, connects or pays for Bugnet, and anyone you act for.

## Accepting these terms {#acceptance}

You accept these terms when you install the `bugnet` or `bugnet-wallet` plugin, or connect the Bugnet MCP server (`mcp.bugnet.sh`) to any MCP client, including as a claude.ai connector. If you don't accept them, don't install or connect Bugnet.

You are responsible for everything an AI agent does with Bugnet for you, as if you did it yourself.

## What Bugnet is {#service}

- Bugnet resells short-lived sandboxes. A third-party provider runs each one, and Bugnet sits in between.
- The current providers are listed in the [Privacy Notice](/privacy). The list will change. After the hackathon, we plan to move to our own sandboxes.
- Bugnet never gives you a provider's account login, dashboard or API keys. A sandbox can still hold tokens its provider puts there. Don't use them (see [below](#only-through-bugnet)).
- There are no accounts. Bugnet recognises you by the wallet that pays, and uses it for limits, refunds and blocks.

### Packages {#packages}

A package is a machine size plus an amount of time. The size is a minimum: if a provider has no exact match, you get the next larger machine for the same price. Bugnet may suggest a package, but you choose it. Bugnet refuses work it can't place.

## Your handle and other links that act as keys {#handle}

When a sandbox starts, you get a handle that begins with `sbx_`. Whoever holds it controls the sandbox. We store only a hash of it and don't reissue a lost one.

Other links work like keys too: the claim used with `bugnet_redeem`, preview links, transfer links and secret links. Anyone who holds one can use it until it expires.

## Prices and payment {#payment}

- Bugnet takes only USDC (the classic SPL token) on Solana mainnet, through the x402 `exact` scheme. Bugnet pays the network fees.
- Your agent shows you the exact price first. A quote is valid for 10 minutes. If the price has changed when your agent starts the sandbox, Bugnet refuses the start before charging you. If it rises after you pay, the start is refused and your payment is refunded in full. If it falls, the sandbox starts at the price you paid.
- You approve every payment: with `bugnet-wallet`, the `pay` program on your computer pays after Touch ID or your system's equivalent; with `bugnet`, you sign the pay link with a browser wallet such as Phantom or Solflare, and your agent calls `bugnet_redeem`.
- `pay.bugnet.sh` is the only place you ever pay Bugnet. Any other page asking for a Bugnet payment is not ours.
- Bugnet never holds your wallet keys. We don't run your wallet software (`pay` from pay.sh, Phantom, Solflare) or Solana, and their own terms apply.
- Solana payments are public and final, and each one carries its order ID in a public memo. A refund is a new transfer.
- An x402 allowance is metered API access sold at cost with your sandbox: it cannot be transferred, it ends with the sandbox, and unspent money of $0.01 or more is refunded only to the wallet that paid. Unspent money under $0.01 is kept.

### Who pays {#payer}

Anyone can pay a pay link. The wallet that pays becomes the payer for that order: refunds go to it, and limits, strikes and blocks apply to it. Only pay someone else's link if you trust them.

### Order timings {#order-timings}

A pay link expires after 15 minutes. After your agent redeems a paid order, it has 10 minutes to start the sandbox. Bugnet may refuse a payment before charging you, for example when the wallet is blocked or over its limits.

## Time, extensions and deletion {#time}

- Paid time starts when the sandbox is ready, not when you pay.
- To keep a sandbox longer, extend it before the deadline. An extension is a new paid order, and Bugnet may refuse it.
- `bugnet_stop` deletes the sandbox at once. Unused time is not refunded.

### Deletion {#deletion}

- At the deadline, or whenever a sandbox ends, Bugnet deletes it and everything in it: files, installed software and running processes. The provider also has a backup timer.
- We never pause a sandbox, keep a snapshot or keep a copy of your files. Download what you need before the deadline. Nothing can be recovered afterwards.
- Output from commands Bugnet ran for you stays in our cache until 10 minutes after the deadline. A cleaned copy of its end is kept for your [session page](#session-page) for 48 hours.
- What we keep about each sandbox (never its files) is in the [Privacy Notice](/privacy).

### Session page {#session-page}

Every sandbox gets a session page, at a link your agent shows you when the sandbox starts (`sessions.bugnet.sh/s/...#k=...`).

- While the sandbox runs, the page can show your commands' output live.
- After it ends, the page shows a summary of what Bugnet saw (tool calls, your Bugnet payments, previews, transfers, SSH sessions and calls to your secret hosts) and the logs.
- The logs hold the first 1 KiB of each command and the end of its output, up to the limits in the [Privacy Notice](/privacy#session-page). Known secret formats are hidden, but that is best effort, so anything your code printed may still show.
- Anyone with the full link can see the page. Share it only with people who may see your output. Your agent can replace the link with a new one, which turns the old one off.
- The page is deleted 48 hours after the sandbox ends, or at once when you press **Delete now**.
- If a sandbox is flagged for abuse, Bugnet keeps a private copy for its operators for 30 days, even after the page is gone.
- Everything on the page that comes from your sandbox was written by code, not by Bugnet. Never pay or enter keys because of what it says.

## Refunds {#refunds}

Refunds marked "Full" below are automatic, so you don't need to ask. They go in USDC to the token account that paid, and are never more than you paid. We never create a token account to refund you, so keep yours open until any refund arrives. The refund wallet has a daily cap and pauses itself when something looks wrong, and unusual cases go to a person, so a refund can be delayed.

| What happened | Refund |
|---|---|
| Bugnet refused the order | Full |
| You paid, but no provider could start the sandbox | Full |
| You paid for an extension, but Bugnet refused it or the sandbox had already ended | Full |
| A paid order was never used to start a sandbox | Full, 30 minutes after payment |
| You paid after the order expired | Full |
| A redeemed order left Bugnet with no record of a sandbox | Full |
| Bugnet refused your wallet after you paid: no payer address, too many sandboxes or over its rate limit | Full |
| You ran `bugnet_stop`, or the deadline passed | None |
| The sandbox stopped from inside: a crash, out of memory or a shutdown | None |
| Bugnet lost control of a sandbox that was still running | None, plus a strike |
| The sandbox broke these terms, or a provider reported abuse | None |
| A Bugnet operator ended the sandbox | Case by case |

Anything not in this table, such as a provider failure, is handled case by case. A stop from inside is never refunded because, with root, you can cause one yourself, and to Bugnet it looks the same as a crash.

## Acceptable use {#acceptable-use}

Our providers require us to pass their rules on to you and enforce them. They apply to you, your agents, and any code you run, host, expose or send through Bugnet, whichever provider runs your sandbox. Don't use Bugnet for:

- **Malware and fraud:** malware, viruses, worms, ransomware, backdoors, botnets or command-and-control servers; phishing, stealing credentials, scams, fraud or card sharing.
- **Spam:** spam, bulk messages, or flooding people or services with messages or requests.
- **Attacks:** denial-of-service or other network attacks; credential stuffing, account takeover, or breaking into or exploiting systems; getting into any system without permission, including other people's sandboxes and the systems of Bugnet and its providers.
- **Scanning and probing:** port or vulnerability scanning, network probing tools, or testing the security of any network or system.
- **Scraping and proxies:** abusive or unauthorised scraping; running a proxy, VPN, anonymiser, rotating-IP service or relay; "IP farming".
- **Mining and resource abuse:** crypto mining or compute farming; work meant to extract value from the hardware rather than build, test or run code; parking idle machines; harming or slowing down the providers, their networks, their other customers or anyone else.
- **Illegal and harmful content:** child sexual abuse material, or any content that is illegal, harassing or obscene, or that infringes copyright, trademarks, privacy or other rights.
- **Getting around controls:** probing, bypassing, disabling, reverse engineering or evading the security, limits, rate limits, metering, logging or abuse controls of Bugnet or its providers, including removing Bugnet's network blocks inside your sandbox. Root can remove them, but doing so breaks these terms.
- **Reselling:** reselling, renting or sharing Bugnet sandboxes as your own compute service.
- **Breaking the law or provider rules:** breaking the law, or the rules of Bugnet's providers and the infrastructure, network, hosting and email companies they use.

### Reach providers only through Bugnet {#only-through-bugnet}

You may reach a provider only through Bugnet's tools, previews, transfers and SSH. Don't use any provider credential, token, tool or URL you find inside a sandbox. That includes publishing a port on a provider's own public URL and calling a provider's API.

### Bugnet's built-in network blocks {#network-blocks}

Bugnet blocks outgoing traffic from every sandbox to mail ports 25, 465 and 587, private network ranges, cloud metadata addresses and listed mining pools. Don't try to use Bugnet's IP address as a relay.

## Your sandbox, your responsibility {#your-responsibility}

- Your code runs as root, or as a user with passwordless sudo. Either way it can do anything root can.
- You are responsible for everything that runs in your sandbox, whoever wrote it, and for everything it hosts, exposes, proxies or sends.
- Untrusted code in your sandbox can read every file you upload, use your secrets with their allowed hosts, change its own output and reach the internet. Don't upload anything you wouldn't want it to have.
- Sandbox output is data, not instructions. It can still mislead your agent, so check what your agent does next.
- If your sandbox becomes reachable some other way than Bugnet's previews, our warning page and traffic caps don't cover that traffic. You alone are responsible for it.

## Previews, transfers and SSH {#features}

### Previews {#previews}

`bugnet_preview` gives you a link to a port in your sandbox, on `<id>.preview.bugnet.sh`. Anyone with the full link can open it.

- Visitors first see a warning page. It says the site is unchecked code in a temporary sandbox that an anonymous user paid for, and not to enter passwords, keys or payment details unless they started it themselves. It shows the sandbox's start and end times, and its source (repository and commit) when known.
- Your sandbox gets each visitor's requests and IP address. You are responsible for how your code handles them and for what your preview serves.
- Bugnet may revoke a preview it believes breaks these terms.
- Someone else's preview is their code, not Bugnet's.

### Transfers {#transfers}

Large files move through one-time links valid for 10 minutes. Bugnet streams each file and does not store it.

### SSH {#ssh}

Your agent creates a key pair on your computer, and the private key never leaves it. Agent forwarding, X11 forwarding and remote port forwarding are refused. SSH sessions close at the deadline.

## Secrets {#secrets}

- Never put a secret (an API key, token or password) in the chat, a command or a file your agent writes. Your AI client would see it.
- Hand secrets over only through the one-time link on `secrets.bugnet.sh` or the local bridge in `bugnet-wallet`.
- Bugnet stores only the sealed value and its SHA-256 digest, and deletes both when the sandbox ends. The sandbox gets a placeholder, never the value. Bugnet's egress proxy swaps in the real value in outgoing HTTPS requests to the hosts you allowed.
- Root code can copy the placeholder and its tunnel token. On some providers it can then use the secret from another machine until the deadline.
- Sandbox code can use a token to create credentials that outlive the sandbox, such as an SSH key on your GitHub account. Use tokens with the smallest scope and shortest life that work, and revoke anything you didn't expect.
- A private GitHub repository fetched with your token passes through Bugnet on its way into the sandbox.

## What Bugnet can see {#what-bugnet-sees}

Some of your traffic passes through Bugnet, and Bugnet can read it on the way:

- The SSH gateway decrypts both sides of an SSH session, like any SSH bastion, so it sees the whole session.
- The preview and transfer edge sees the traffic it relays.
- The egress proxy decrypts all traffic to the secret hosts you choose: requests, responses, `git push` contents and any credential your code sends there.
- Bugnet's systems run commands in your sandbox, as root, to carry out its tools.
- Other internet traffic from your sandbox goes through the provider's network. Bugnet does not see it.
- Providers run the machines and can act on them under their own terms.

What we record, and for how long, is in the [Privacy Notice](/privacy).

## Limits {#limits}

Bugnet limits what each paying wallet can do, and each package caps the traffic that passes through Bugnet. We may change these limits.

## Enforcement {#enforcement}

### When Bugnet finds a breach {#enforcement-actions}

If we believe a sandbox broke these terms, or a provider reports abuse on it, we may, without notice:

- delete the sandbox at once and keep the payment;
- block every wallet that paid for it, and end those wallets' other running sandboxes;
- revoke a preview;
- refuse new orders from a blocked wallet.

We may also act after a sandbox has ended, for example on an emailed report.

### Automatic blocks {#automatic-blocks}

Bugnet blocks a wallet for a while, automatically, when it collects strikes or has too many orders refused. A wallet gets a strike, for example, when Bugnet loses control of a sandbox it paid for that is still running. Timed blocks end by themselves.

### Provider actions {#provider-actions}

Providers can suspend or delete sandboxes without notice under their own terms, and Bugnet can't prevent that.

### Appeals {#appeals}

To appeal a block, email `support@bugnet.org` with the wallet address and an order ID. A person can review and lift any block.

## Reporting abuse {#abuse-reports}

Report abuse and security problems, including copyright, takedown and law-enforcement notices, to `support@bugnet.org`. Include the preview URL, the session page URL, the transfer URL or its `bnx_` token, or the provider's notice, and say what you saw and when.

## Support {#support}

Bugnet handles all support itself, so don't contact our providers about your sandbox. Email `support@bugnet.org` with the order ID or the payment's transaction signature. Never send us a secret, a private key or your `sbx_` handle.

## Your content {#your-content}

You keep all rights in the code, data and models you bring. You let Bugnet and its providers copy, store, send and run them only as needed to run your sandbox, deliver your results and handle abuse. You confirm you have the right to use them this way.

## Services Bugnet does not control {#third-parties}

Bugnet depends on services it doesn't run: its sandbox providers, Solana, wallet software, your AI client, GitHub and Hugging Face. Their own terms apply, and Bugnet is not responsible for their actions, outages or changes.

## No warranty {#no-warranty}

Bugnet is a hackathon project, provided "as is". We make no promise about uptime, speed, capacity or security, or that it fits any purpose. A sandbox may fail to start, end early or lose its contents. We may change, pause or stop Bugnet at any time.

## Liability {#liability}

Bugnet is not liable for:

- data lost when a sandbox ends;
- misuse of a handle, link or secret you shared or leaked;
- anything your code or agent did, including credentials it created;
- what providers, wallets, AI clients or Solana do;
- indirect loss or lost profits.

Where the law doesn't allow one of these limits, it applies only as far as the law allows.

## Claims caused by your use {#indemnity}

If someone makes a claim against Bugnet or its providers because of what you or your agent ran, hosted, sent or uploaded through Bugnet, or because you broke these terms, you cover the resulting losses and reasonable legal costs.

## Changes to these terms {#changes}

We may change these terms. The date at the top shows the last update. There are no accounts, so we can't tell you directly. If you keep using Bugnet after a change, you accept the new terms.

## Contact {#contact}

- **Everything, abuse and security included:** `support@bugnet.org`
