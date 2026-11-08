# bugnet-website

The Bugnet web pages: the session page, where a person reads what happened in a sandbox run
from a link and a key, and the bugnet.sh site.

## Layout

- `packages/brand`: design tokens (`tokens.css`), the self-hosted fonts, the logo and icon, and
  the contrast check every colour pair must pass.
- `packages/session-page`: the session page: it reads a session link and its key, asks the
  sessions route, and shows the running or ended session with its map and commands.
  `pnpm dev` builds it and serves it with a fake sessions route, printing one link per sample
  scenario.
- `packages/site`: the bugnet.sh site, a Next.js static export to `out/`, with `out/headers.txt`
  holding each page's security headers. `pnpm dev:site` runs it; start the fake stats feed with
  `pnpm --filter @bugnet/site exec tsx scripts/fake-stats.ts` (port 8461).

## Commands

```bash
pnpm install
pnpm test        # vitest
pnpm typecheck   # tsc in every package
pnpm lint        # eslint and prettier --check
pnpm format      # prettier --write
pnpm contrast    # WCAG contrast of every text/surface token pair
pnpm dev         # session page dev server
pnpm dev:site    # site dev server; /api/stats goes to 127.0.0.1:8461
pnpm build       # build every package
```

Rebuild the fonts with `packages/brand/scripts/fonts.sh`; sources and licenses are in
`packages/brand/fonts/SOURCES.md`.

## Design

In the main Bugnet repository: the session page in `docs/website/session-page-ui.md` and
`docs/website/session-page.md`; the site and stats page in `docs/website/site-and-stats.md`.
