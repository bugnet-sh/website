---
title: Watching a run
---

# Watching a run

You follow a run in two places: in the chat, where your agent reports each result, and on the
session page, which shows the whole run in a browser.

## In the chat {#in-the-chat}

- `bugnet_exec` runs a shell command and returns its exit code and the last 8 KiB of its output
  and of its errors.
- Every tool call answers within 45 seconds. A longer command keeps running, and your agent
  follows it with `bugnet_job`. `bugnet_cancel_job` stops it.
- `bugnet_status` shows the state, the time left and what more time costs.

Ask your agent for any of these at any time, such as "how much time is left?" or "show me the full
error".

## The session page {#the-session-page}

Every sandbox gets a session page at `https://sessions.bugnet.sh/s/<id>#k=<key>`.

1. Copy the link your agent shows you when the sandbox starts.
2. Open it in a browser.

Your agent gets the link from `bugnet_start`, again from `bugnet_stop`, and from any tool called on
an ended sandbox, with an instruction to show it to you.

While the sandbox runs, the page shows its output live. After it ends, it shows:

- a map of the calls Bugnet saw in the session, such as tool calls, and Bugnet's own payments with
  amounts and transaction signatures linked to an explorer;
- a log view: each command's output and errors, with exit codes, in plain text;
- the start time, the end time and why it ended.

Other internet traffic from the sandbox is not seen by Bugnet, so it is not on the page.

## Deleting the page {#deleting-the-page}

The page is deleted 48 hours after the sandbox ends. To delete it sooner:

1. Open the page.
2. Click **Delete now**.

After 48 hours your agent no longer gets a link.

## The link {#the-link}

- The key is the part after `#k=`. Browsers never send that part of a link, so it stays out of
  server logs, caches and link previews.
- Once the page opens, the key leaves the address bar, so a screen share does not show it.
- The page is read-only. Its key cannot run commands or reach files.
- Anyone with the full link can read the page. Your agent can replace the link with a new one,
  which turns the old one off and keeps the page.
- The page has a **Report abuse** link to `support@bugnet.org`.
