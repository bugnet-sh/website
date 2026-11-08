---
title: Safety
sources:
    - bugnet-gateway/README.md: Security model
    - docs/website/plan.md: section 2, /docs#safety
---

# Safety

## No AI on Bugnet's side

Bugnet's server is plain code. It calls no AI model and does not read your conversation. It sees
only the tool calls your agent sends. Your own agent decides when to suggest Bugnet.

The risk check in `bugnet_assess` is a set of fixed rules: repo age and stars, install scripts
that download or run binaries, hidden code, model files that can run code when loaded, and
whether your machine has the memory or GPU the work needs. It returns short findings, never the
files it read.

## The sandbox

- Code in the sandbox runs on a cloud machine, not yours. It cannot reach your files, your keys
  or your local network.
- Everything is deleted at the deadline. Download what you need before then.
- Sandbox output is treated as untrusted. Bugnet strips terminal escape codes, hidden control
  characters and text direction tricks, keeps the last 8 KiB of each stream, and labels it as
  data, not instructions.
- The sandbox handle, which starts with `sbx_`, is the only key to your sandbox. Keep it private.
  Bugnet's logs name a sandbox only by a short hash of it.
- Bugnet's server refuses calls from web pages on other sites, apart from hosted clients such as
  claude.ai, and no page can show it in a frame.

Sandboxes run on cloud machines that Bugnet rents from hosting companies, and those companies run
the hardware your sandbox is on.

## What Bugnet can and cannot see

Bugnet can see:

- the tool calls your agent sends, such as commands, file contents and repo or model names;
- what the sandbox sends back, such as output and files;
- your IP address, which limits how often `bugnet_assess` and `bugnet_quote` are called;
- the wallet that paid, which is public on Solana anyway.

Bugnet cannot see:

- your conversation with your agent;
- anything on your computer that your agent does not send;
- your wallet keys, which stay in your wallet.

## Security problems

Report them privately, as
[SECURITY.md](https://github.com/bugnet-sh/bugnet/blob/main/SECURITY.md) says.
