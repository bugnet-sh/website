# Font sources

The five `.woff2` files are cut by `../scripts/fonts.sh` (fonttools 4.60.1, `fonttools[woff]`).
The script downloads each source, checks its SHA-256, instances the variable axis, then subsets.

| Output                                                        | Source                                                                                                                            | SHA-256                                                                | Instance                           |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------- |
| `manrope-400.woff2`, `manrope-500.woff2`, `manrope-600.woff2` | `https://raw.githubusercontent.com/google/fonts/86aced91de05cd4f96a06838124cca45be337b2b/ofl/manrope/Manrope%5Bwght%5D.ttf`       | `3ae11c49db0455a3cc33e37d380f20fdb8c7f8b41dc07625c177e3d87a9d6ae6`     | `wght=400`, `wght=500`, `wght=600` |
| `lexend-deca-200.woff2`                                       | `https://raw.githubusercontent.com/google/fonts/86aced91de05cd4f96a06838124cca45be337b2b/ofl/lexenddeca/LexendDeca%5Bwght%5D.ttf` | `d11c12298f431d7e416a1e615d33f2c2b98bda2318a0c186c8c94f08c2d90ce8`     | `wght=200`                         |
| `obel-mono-400.woff2`                                         | `ObelMono-1.002-woff2/ObelMono-VF.woff2` in `https://typographic.systems/download/ObelMono-1.002-woff2.zip`                       | zip `789760993c70f01bcb25cb6db02457ebf77febd12078ab00085218e6d41b14df` | `wght=400`                         |

## Commands

```text
fonttools varLib.instancer <source> wght=<weight> -o <tmp>.ttf
pyftsubset <tmp>.ttf --unicodes=<set> --layout-features=<list> --flavor=woff2 --output-file=<out>
```

- UI set (Manrope, Lexend Deca): `U+0020-007E,U+00A0-00FF,U+0100-017F,U+2000-206F,U+20AC,U+2122,U+2190-21FF,U+2212,U+FFFD`
- Mono set (Obel Mono): the UI set plus `U+2500-259F,U+25A0-25FF,U+2800-28FF` (box drawing, blocks, shapes, braille spinners)
- Layout features, Manrope and Lexend Deca: `kern,liga,calt,ccmp,locl,case,tnum,lnum`
- Layout features, Obel Mono: `ccmp,locl,case`

The Obel Mono archive ships a woff2, which the script decompresses to a TTF before instancing.

## Licenses

All three are SIL Open Font License 1.1.

| File                  | Source (SHA-256)                                                                                                     | Copyright line                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `OFL-manrope.txt`     | `.../ofl/manrope/OFL.txt` at the same commit (`58172e0c0fac2cda8a37b348164bb55e44b0e69051e557e92b1d3f6910141f7b`)    | Copyright 2018 The Manrope Project Authors (https://github.com/googlefonts/manrope)                                             |
| `OFL-lexend-deca.txt` | `.../ofl/lexenddeca/OFL.txt` at the same commit (`5da8505887d0fa7fe963445fd58852707fda34adfeb65af25c99d152bab285bd`) | Copyright 2018 The Lexend Project Authors (https://github.com/googlefonts/lexend), with Reserved Font Name "RevReading Lexend". |
| `OFL-obel-mono.txt`   | `https://typographic.systems/download/OFL.txt` (`6fd1d5747b4d6988d19b4b2b0456fb16d567a0b4e9c4ec8008fbe489478b343e`)  | Copyright 2026 The Obel Mono Project Authors (https://typographic.systems)                                                      |

The Lexend license reserves only the name "RevReading Lexend", which we never use.
