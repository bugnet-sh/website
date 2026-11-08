Last updated: 7 November 2026

# Privacy Notice {#privacy}

Bugnet is a hackathon project. This page explains what data Bugnet handles when you use it, and why. The rules for using Bugnet are in the [Terms](/terms).

## The short version {#summary}

- There are no accounts. We never ask for your name, email or phone number.
- When you pay, we see your Solana wallet address. Payments are public on Solana, and nobody can erase them.
- We use IP addresses to rate-limit requests and stop abuse.
- Your sandbox runs at one of the providers named below. Everything in it is deleted at the deadline. A summary and the logs stay on your session page for 48 hours, unless you delete them.
- Some traffic passes through our servers in readable form: SSH, previews, file transfers, and traffic to hosts you chose for a secret.
- The bugnet.sh website sets no cookies and runs no analytics.
- The public stats page at bugnet.sh/stats lists each sandbox and payment of the last 30 days with its wallet address and transaction link, never what was run.
- Email abuse@bugnet.org for abuse and security. Email support@bugnet.org for everything else.

## Who this covers {#scope}

- **Users:** people who run sandboxes through the Bugnet MCP server or the `bugnet` or `bugnet-wallet` plugin. Installing or connecting any of them means you accept the [Terms](/terms).
- **Payers:** anyone who pays a Bugnet order. Anyone can pay a pay link, not just the person who created it.
- **People who open a preview or transfer link** that someone shared.
- **People who email us**, and **visitors to bugnet.sh**.

## No accounts {#no-accounts}

We don't know who you are. We work with these IDs:

- your wallet address, when you pay
- order IDs and sandbox IDs
- your sandbox handle (`sbx_…`), which we store only as a hash
- IP addresses

None of these IDs contains your name. They can still point to you, for example if someone links your wallet to you.

## What we handle and why {#data}

### Payments and your wallet {#payments}

For each order we record:

- what you bought
- the amount
- the payer's wallet address
- the transaction signature
- the order's state

For a refund we keep the refund transaction. For each wallet we keep when we first and last saw it, plus any blocks and strikes.

We use this to:

- take your payment
- start your sandbox
- refund you automatically when a refund is due (refunds go back to the token account that paid)
- apply per-wallet limits, and block wallets that abuse Bugnet
- list sandboxes and payments on the public [stats page](#stats-page)

How paying works:

- We settle payments ourselves. No payment company handles them. We pay the Solana network fees and send transactions through a Solana RPC service.
- **`bugnet-wallet`:** the `pay` CLI keeps your key in your system keychain. It asks for Touch ID (or Windows Hello or polkit) for each payment.
- **`bugnet`:** you pay at `pay.bugnet.sh` with a browser wallet such as Phantom or Solflare. Your key stays in your wallet.
- We never see your private key.
- If you pay someone else's pay link, your wallet becomes the payer for that order. Any refunds, strikes and blocks for that order go to your wallet.

### On the Solana blockchain {#blockchain}

Every payment and refund is a public Solana transaction. Anyone can see:

- the payer's wallet address
- the amount
- our addresses
- the order ID, which is written in the transaction memo

Nobody can change or erase this, including us. Order IDs are public, so an order ID alone does not prove an order is yours.

### IP addresses {#ip}

Each public entry point counts requests per IP address, to rate-limit and stop abuse. These counters last about 10 minutes.

- Our server logs can include IP addresses.
- The egress proxy logs the IP address of a tunnel it refuses. That is a sign that a sandbox's access token has leaked.
- While you approve and pay, we may hold a sandbox for you and store your IP address with that hold. We clear the address when the sandbox ends.
- Calls through claude.ai or Claude Desktop connectors come from Anthropic's network. For those calls we see Anthropic's address, not yours.

### Your sandbox {#sandbox}

- **What you run.** We look up the repository or model you name, its revision and the kind of workload, so we can size and price the sandbox. We keep a hash of the entry command, never its text. The sandbox record keeps the repository or model name and revision with the payer's wallet.
- **Usage.** After a run we record peak memory, CPU time and disk use. This improves later estimates.
- **Contents.** Your code, files and everything your code writes live at the provider. Everything in the sandbox is deleted at the deadline, or sooner if you stop it. We never pause or snapshot it, so download what you need before the deadline.
- **Commands.** We keep each job's state, exit code and byte counts. Output streams stay until 10 minutes after the deadline, so your agent can read them. For your [session page](#session-page) we also keep the first 1 KiB of each command and the end of its output, cleaned and with known secret formats hidden.
- **Files.** Small files go through our gateway. Bigger files use a one-time transfer link, which our edge streams without storing the file. We keep a hash of each transfer link for 30 days so we can trace abuse reports.
- **Private repositories.** If you give us a GitHub token, we fetch the repository through our egress proxy and stream it into your sandbox. We don't store it.
- **Root access.** You get full control of the sandbox (root, or sudo on some providers). What you do with it is your responsibility. Our systems also have root access, because that is how they run your commands. While the sandbox runs, they can read what is in it.
- **Other people's data.** If you put other people's personal data in a sandbox, you must have the right to use it that way.

### Traffic that passes through our servers {#relayed-traffic}

Some of your traffic goes through Bugnet, and our servers can read it:

- **SSH.** Our SSH gateway sees your session, as any SSH jump host does. We record your SSH public key and the sandbox's host key. Key fingerprints appear in our logs.
- **Previews and file transfers.** Our edge relays this traffic and sees it.
- **Secret hosts.** Our egress proxy decrypts all traffic from your sandbox to the hosts you chose for a secret. That includes request and response bodies, `git push` contents, and anything else your code sends to those hosts.

We relay this traffic and don't save copies of it.

Other internet traffic from your sandbox leaves through the provider's network. We don't see it, but the provider may.

If you or your code expose the sandbox some other way, that traffic does not go through Bugnet. You are responsible for it.

You reach our providers only through Bugnet. Boat's terms require this for Boat.

### If you open a preview {#preview-visitors}

A preview is a site that a Bugnet user's code serves from their sandbox. That code belongs to the user, not to us.

- The warning page shows when the sandbox started, when it ends, and its source (repository and commit) when known.
- Your requests pass through our edge and the provider to the sandbox. The code there receives your requests and your IP address. The user who started the sandbox is responsible for what it does with them.
- Don't enter passwords, keys or payment details unless you started the sandbox yourself.

### Your session page {#session-page}

Each sandbox has a session page (see the [Terms](/terms#session-page)).

- **What is on it:**
  - a summary of what Bugnet saw: tool calls (name, time and outcome, never their arguments), your Bugnet payments (amounts and transaction links), previews, transfers, SSH sessions and calls to your secret hosts;
  - the logs: the first 1 KiB of each command, and the last 64 KiB of each command's output and error streams, up to 4 MiB per sandbox. When our storage for session pages is nearly full, new pages keep only the last 8 KiB per stream. Control characters are removed, and known secret formats are hidden. That is best effort.
- **What is not on it:** your wallet address, the sandbox handle, IP addresses and provider names. Each transaction link opens a public explorer, and that explorer shows the paying wallet.
- **Other traffic:** internet traffic from your sandbox that does not pass through our servers is not seen by Bugnet and not on the page.
- **Who can see it:** anyone with the full link. The secret part of the link sits after `#`, so browsers never send it to our servers, and our servers never log it. Your agent can replace the link, which turns the old one off.
- **How long:** live while the sandbox runs, then 48 hours after it ends. **Delete now** removes it at once.
- **Flagged sandboxes:** if a sandbox is flagged for abuse, we keep a private copy for our operators for 30 days, even after the page is deleted or you press Delete now. It is never shown publicly.

### Secrets {#secrets}

You give a secret, such as an API token, through a one-time secret link or through the local bridge in `bugnet-wallet`.

- The link works once and expires after 10 minutes.
- The bridge reads the value from an environment variable, a `.env` file or your keychain, and asks you to confirm each time. If your AI client can't show that question, the bridge reads without asking, but only for preset hosts, from a source named like the secret, and for sandboxes it started.
- The page or the bridge seals the value before sending it. The value never goes through the chat.
- We store only sealed boxes and SHA-256 digests. Only our egress proxy opens them. It opens them in memory and puts the real value into requests to the hosts you allowed. The sandbox gets a placeholder, never the value.
- Secrets are deleted when the sandbox ends. A cleanup job removes anything left over 1 hour after the deadline.
- We log secret names and hosts, never values.

### Abuse {#abuse}

We keep the abuse signals our providers send. For each wallet we also keep a log of blocks, strikes and notes, with evidence. The evidence never includes secrets. For a sandbox flagged for abuse, we keep its session record (summary and logs) privately for 30 days.

Reports to abuse@bugnet.org usually include a preview URL, a transfer link or a provider's notice. We use them to find the sandbox and the wallet that paid for it. When a sandbox is used for abuse, we end it, keep the payment and block the wallet. The [Terms](/terms) say what counts as abuse.

Our providers also run their own checks:

- Boat checks its machines for abuse, even though we turn its monitoring off.
- boxd watches network patterns, not what is inside machines. It may report illegal content to the authorities, along with the account details, and those details are Bugnet's.
- Koyeb says it does not monitor content.

### Logs {#logs}

Our services log:

- order IDs
- a short tag made from a hash of your handle
- secret names and hosts
- preview IDs and ports
- SSH key fingerprints
- IP addresses, as described under [IP addresses](#ip)
- operator actions

They never log full handles, order claims, payment payloads or secret values.

### Traces {#traces}

Traces record the steps of one order, such as timings, errors and provider calls, so we can find bugs. They hold only order and sandbox IDs. They never hold handles, IP addresses, wallets, repository names, commands or file paths. If we turn traces on, they go to Grafana Labs (EU region).

### Email {#email}

When you email us, we get your address, your message and any attachments. We use them to answer you and to act on reports.

### The bugnet.sh website {#website}

bugnet.sh is a set of static pages on our own server. It sets no cookies, runs no analytics and makes no requests to other companies. Our front proxy logs connections to it.

### The public stats page {#stats-page}

bugnet.sh/stats shows how Bugnet is used, so anyone can check our numbers.

- **Totals for all time:** sandboxes, compute hours, money in and out, refunds, provider health and our limits. These hold no wallet addresses.
- **Each sandbox of the last 30 days:** when it ran, the provider, its size and length, how many commands ran, the price, how it ended, the paying wallet address, and the payment's transaction link.
- **Each payment and refund of the last 30 days:** the time, the kind, the amount, the wallet address and the transaction link.
- **Never on it:** repository or model names, commands, output, links to previews, transfers or session pages, IP addresses and secret hosts.

Wallets and transactions are already public on Solana. The stats page links them to the sandboxes they paid for. Rows older than 30 days leave the page; the totals keep counting them.

## What stays on your machine {#on-your-machine}

These parts run on your computer and send us nothing on their own:

- **The plugin hook.** It reads your prompts, your Bash commands and the errors of failed Bash commands, on your machine, to decide whether to suggest Bugnet. It keeps a small file for each session with the hints it showed, the repositories you cloned and whether you used Bugnet. Now and then it deletes files older than 2 days, so a file can last longer if the hook rarely runs.
- **The bridge.** It reads a secret only as described under [Secrets](#secrets), and seals it before sending.
- **The `pay` wallet.** Your key stays in your system keychain.

## Cookies {#cookies}

- **bugnet.sh** and the **secret page** (`secrets.bugnet.sh`): no cookies.
- **Previews** (`<id>.preview.bugnet.sh`): one cookie, `__Host-bnp`, set after you click through the warning page. It holds the preview's access token and ends with your browser session. The preview's own code may set other cookies. Those cookies aren't ours.

Until `preview.bugnet.sh` is on the Public Suffix List, code on a preview can set cookies for every bugnet.sh address. Our pages ignore cookies they didn't set.

Your wallet extension, such as Phantom or Solflare, is your own software with its own privacy terms.

## Automatic wallet blocks {#automated-decisions}

Some blocks happen automatically:

- **Abuse report from a provider.** If a provider reports abuse on a sandbox, the sandbox ends. Every wallet that paid for it is blocked until a person lifts the block. Those wallets' other running sandboxes may stop too.
- **Strikes and refused orders.** Repeated strikes give a timed block. A wallet gets a strike, for example, when we lose control of a sandbox it paid for that is still running. Many orders refused in a short time, because the wallet ran too many sandboxes or started them too fast, also give a timed block.

A blocked wallet can't buy sandboxes. Timed blocks end on their own. A person can review and lift any block, and every operator action is logged. If you think a block is wrong, email support@bugnet.org with the wallet address and an order ID.

## Who receives your data {#recipients}

### Sandbox providers {#providers}

For each run, our router picks one of these providers. Our tools don't tell you which one. The provider receives everything in your sandbox:

- your code and files
- the commands we run and their output
- the network traffic
- the labels we attach to the sandbox

| Provider | Company | Where sandboxes run |
|---|---|---|
| Koyeb | Koyeb SAS, France | Frankfurt, Germany |
| Boat (boat.dev) | Dedale AI, Corp., United States | Germany, Finland or France. We can't choose the region. We turn snapshots off. |
| E2B (e2b.dev) | FoundryLabs, Inc., United States | Our design uses EU-West-1. E2B's default region is US-West-1. |
| boxd (boxd.sh) | Azin Tech Operating Company B.V., Netherlands | Frankfurt, Germany, on servers from Latitude.sh LLC (United States) |

Providers use other companies too. Koyeb lists Equinix Metal, IBM Cloud, Scaleway and Amazon Web Services. Boat names OVH, Hetzner and Cloudflare. Each provider keeps its own logs under its own terms.

### Others {#processors}

- **Our server.** All Bugnet services run on one rented server in the EU. That includes the website, MCP gateway, router, payments, edges, SSH gateway, egress proxy and their databases.
- **Grafana Labs** (EU region): traces, only if we turn them on.
- **A Solana RPC service:** sends our payment and refund transactions to Solana.
- **The Solana network:** payments and refunds are public (see [On the Solana blockchain](#blockchain)).
- **GitHub and Hugging Face:** we look up the repositories and models you name. We also fetch script URLs your agent sends to the safety check, and use your GitHub token to fetch a private repository. These requests come from our servers.
- **Your AI client**, such as Claude Code: it receives tool results, and its provider's terms cover them there.
- **The owner of a preview you open** (see [If you open a preview](#preview-visitors)).
- **Authorities**, when the law requires it.

Some of these are US companies or may keep data in the US. That includes the companies behind Boat and E2B, boxd's server host, some of the providers' own suppliers, GitHub and Hugging Face.

## What we keep and for how long {#retention}

| Data | Why | How long |
|---|---|---|
| Sandbox contents (code, files, everything your code writes) | Run your sandbox | Deleted at the deadline, or sooner if you stop the sandbox |
| Command output streams | So your agent can read them | Until 10 minutes after the deadline |
| Session page (summary, first 1 KiB of each command, end of the output) | Show you what happened | Live while running, then 48 hours after the end, or until you press Delete now |
| Session record of a sandbox flagged for abuse | Handle abuse | 30 days, operators only |
| Secrets (sealed) | Put your secret into requests to hosts you allow | Deleted when the sandbox ends. Leftovers are removed 1 hour after the deadline. |
| Secret link | Let you hand over a secret once | 10 minutes, one use |
| Per-IP rate-limit counters | Rate limits and abuse | About 10 minutes |
| IP address held while you pay | Cap sandboxes per address | Cleared when the sandbox ends |
| Preview records, SSH public keys, sandbox host keys | Run previews and SSH, trace abuse | 7 days after the sandbox ends |
| Transfer link hashes | Trace abuse reports | 30 days |
| Usage figures (memory, CPU, disk) | Better size and price estimates | 90 days |
| Provider abuse signals | Handle abuse | 90 days |
| Orders, payments, refunds and sandbox records (wallet, amount, repository and revision) | Run Bugnet, refunds, abuse | As long as needed to run Bugnet and handle abuse |
| Wallet records, blocks, strikes and evidence | Handle abuse | As long as needed to run Bugnet and handle abuse |
| Server logs | Security and fixing bugs | As long as needed to run Bugnet and handle abuse |
| Traces at Grafana Labs, if on | Fixing bugs | 14 days (Grafana's free tier) |
| Email to abuse@ and support@ | Answer you, act on reports | As long as needed to run Bugnet and handle abuse |
| Plugin hook files, on your machine | Decide when to suggest Bugnet | Removed once older than 2 days, the next time the hook cleans up |
| Rows on the public stats page (wallet, transaction, sandbox numbers) | Show how Bugnet is used | 30 days on the page; totals keep counting |
| Payments and refunds on Solana | Public blockchain | Forever. Nobody can erase them. |

## Security {#security}

- We store sandbox handles only as hashes, and we never log order claims.
- Provider access tokens are sealed in our database, so a database leak alone does not reveal them.
- Secrets are sealed to keys built into the secret page and the bridge. Our router, edges, gateway and databases only see sealed boxes.
- We never put our provider account logins or API keys inside your sandbox.

Nothing is perfectly secure. If you find a security problem, email abuse@bugnet.org.

## Your choices {#rights}

You can ask us for a copy of your data, ask us to fix it, or ask us to delete it. Email support@bugnet.org with something that identifies your data: a wallet address, an order ID or a transaction signature. We may ask you to show that you control the wallet.

- We can't delete anything on Solana.
- We may keep abuse evidence and payment records when we need them to protect Bugnet.
- If nothing we hold links the data to you any more, we can't find it.

## Changes {#changes}

Our list of providers will change. After the hackathon, Bugnet plans to move to its own sandboxes, and this page will change with it. There are no accounts, so we can't tell you directly. We will update this page and the date at the top.

## Contact {#contact}

- Abuse and security: abuse@bugnet.org
- Everything else: support@bugnet.org
