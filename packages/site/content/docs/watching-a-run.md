---
title: Watching a run
sources:
    - bugnet-gateway/README.md: Tools; Limits
    - docs/website/plan.md: section 2, /docs#watching-a-run
    - docs/website/session-page.md: sections 1 to 3; section 10, D-a, D-e and D-g
---

# Watching a run

## In the chat

- `bugnet_exec` runs a shell command and returns its exit code and the last 8 KiB of its output
  and of its errors.
- Every tool call answers within 45 seconds. A longer command keeps running, and your agent
  follows it with `bugnet_job`. `bugnet_cancel_job` stops it.
- `bugnet_status` shows the state, time left and extension prices.

## The session page

Every sandbox gets a session page at `https://sessions.bugnet.sh/s/<id>#k=<key>`. Your agent shows
you the link.

- While the sandbox runs, the page shows its output live. After it ends, it shows the summary.
- A map of the calls Bugnet sees in the session, such as tool calls, and Bugnet's own payments
  with amounts and transaction signatures linked to an explorer.
- A log view: each command's output and errors, with exit codes, in plain text.
- The start time, the end time and why it ended.
- Other internet traffic from the sandbox is not seen by Bugnet.

The page is deleted 48 hours after the sandbox ends, or at once with **Delete now**.

## The link

- The key is the part after `#k=`. Browsers never send that part of a link, so it stays out of
  server logs, caches and link previews.
- The page is read-only. Its key cannot run commands or reach files.
- Anyone with the full link can read the page. Your agent can replace the link with a new one,
  which turns the old one off.
