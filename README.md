# bugnet-website

The Bugnet web pages: the session page, where a person reads what happened in a sandbox run
from a link and a key, and the bugnet.sh site.

## Layout

- `packages/brand`: design tokens (`tokens.css`), the self-hosted fonts, the logo and icon, and
  the contrast check every colour pair must pass.
- `packages/session-page`: the session page itself.
- `packages/site`: the bugnet.sh site, a Next.js static export to `out/`, with `out/headers.txt`
  holding each page's security headers.

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

The page design is in `docs/website/session-page-ui.md` and the wire format in
`docs/website/session-page.md` (sections 7.2 and 7.3.1) of the main Bugnet repository.
