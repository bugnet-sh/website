# bugnet-website

The Bugnet web pages. Today that is the session page, where a person reads what happened in a
sandbox run from a link and a key. The four bugnet.sh pages come later.

## Layout

- `packages/brand`: design tokens (`tokens.css`), the self-hosted fonts, the logo and icon, and
  the contrast check every colour pair must pass.
- `packages/session-page`: the session page itself (added in later tasks).

## Commands

```bash
pnpm install
pnpm test        # vitest
pnpm typecheck   # tsc in every package
pnpm lint        # eslint and prettier --check
pnpm format      # prettier --write
pnpm contrast    # WCAG contrast of every text/surface token pair
pnpm dev         # session page dev server
pnpm build       # build every package
```

Rebuild the fonts with `packages/brand/scripts/fonts.sh`; sources and licenses are in
`packages/brand/fonts/SOURCES.md`.

## Design

The page design is in `docs/website/session-page-ui.md` and the wire format in
`docs/website/session-page.md` (sections 7.2 and 7.3.1) of the main Bugnet repository.
