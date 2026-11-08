---
title: Limits
sources:
    - bugnet-gateway/README.md: Limits; Security model, What Bugnet will not run
    - docs/website/plan.md: section 2, /docs#limits
---

# Limits

Your agent quotes the exact price before you approve.

- Sandboxes run Linux. Windows and macOS programs can be inspected there but not run.
- Every tool call answers within 45 seconds. Longer commands keep running, and your agent follows
  them with `bugnet_job`.
- Each call returns the last 8 KiB of a command's output and of its errors. Read whole files with
  `bugnet_read_file`.
- `bugnet_read_file` and `bugnet_write_file` move up to 256 KiB per call.
- A quote is valid for 10 minutes.
- Everything is deleted at the deadline. Unused time is not refunded when you stop early.

## Current values

The live caps per wallet, per sandbox and per IP address are on the
[stats page](/stats/#limits).

## What Bugnet will not run

Crypto miners, floods and DDoS tools, mass scanning, scans of local networks, credential stuffing
and mass messaging. Bugnet tells agents never to offer a sandbox for these, not even to inspect
them as a test. A sandbox used for them is ended. The full rules are in
[Acceptable use](/terms/#acceptable-use).
