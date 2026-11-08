---
title: Limits
---

# Limits

Your agent quotes the exact price before you approve.

## The sandbox {#the-sandbox}

- Sandboxes run Linux. Windows and macOS programs can be inspected there but not run.
- A sandbox comes in fixed sizes of CPU, memory, disk and minutes.
- GPU sandboxes are offered only when available. A GPU has to be asked for when the agent gets the
  quote, and a running sandbox cannot add one later.
- Everything is deleted at the deadline. Unused time is not refunded when you stop early.

## Time {#time}

| What                         | Limit                                   |
| ---------------------------- | --------------------------------------- |
| A tool call                  | Answers within 45 seconds               |
| A quote                      | Valid for 10 minutes                    |
| An unpaid order              | Expires after 15 minutes                |
| A paid order with no sandbox | Refunded after 30 minutes               |
| A transfer link              | Valid for 10 minutes, used once         |
| The session page             | Deleted 48 hours after the sandbox ends |

A command that runs longer than 45 seconds keeps running, and your agent follows it with
`bugnet_job`.

## Output and files {#output-and-files}

- Each call returns the last 8 KiB of a command's output and of its errors. Read whole files with
  `bugnet_read_file`.
- `bugnet_read_file` and `bugnet_write_file` move up to 256 KiB per call. For bigger files,
  `bugnet_transfer` gives a one-use `curl` link.

## Calls {#calls}

`bugnet_assess` and `bugnet_quote` together allow 12 calls a minute per IP address, in bursts of up
to 10.

## Current values {#current-values}

The live caps per wallet, per sandbox and per IP address are on the
[stats page](/stats/#limits).

## What Bugnet will not run {#what-bugnet-will-not-run}

- crypto miners;
- floods and DDoS tools;
- mass scanning, and scans of local networks;
- credential stuffing;
- mass messaging.

Bugnet tells agents never to offer a sandbox for these, not even to inspect them as a test. A
sandbox used for them is ended. The full rules are in [Acceptable use](/terms/#acceptable-use).
