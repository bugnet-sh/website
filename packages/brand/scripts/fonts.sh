#!/usr/bin/env bash
# Rebuilds fonts/*.woff2 from pinned upstream sources. The outputs are committed, so this only
# runs when a font or its character set changes.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="$here/fonts"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

gf="https://raw.githubusercontent.com/google/fonts/86aced91de05cd4f96a06838124cca45be337b2b/ofl"
obel_zip="https://typographic.systems/download/ObelMono-1.002-woff2.zip"

ui_set="U+0020-007E,U+00A0-00FF,U+0100-017F,U+2000-206F,U+20AC,U+2122,U+2190-21FF,U+2212,U+FFFD"
mono_set="$ui_set,U+2500-259F,U+25A0-25FF,U+2800-28FF"
ui_features="kern,liga,calt,ccmp,locl,case,tnum,lnum"
mono_features="ccmp,locl,case"

fetch() { # url sha256 destination
    curl --fail --silent --show-error --location "$1" --output "$3"
    local got
    got="$(shasum -a 256 "$3" | cut -d' ' -f1)"
    if [ "$got" != "$2" ]; then
        echo "checksum mismatch for $1: expected $2, got $got" >&2
        exit 1
    fi
}

python3 -m venv "$work/venv"
"$work/venv/bin/pip" install --quiet 'fonttools[woff]==4.60.1'
export PATH="$work/venv/bin:$PATH"

fetch "$gf/manrope/Manrope%5Bwght%5D.ttf" \
    3ae11c49db0455a3cc33e37d380f20fdb8c7f8b41dc07625c177e3d87a9d6ae6 "$work/manrope.ttf"
fetch "$gf/lexenddeca/LexendDeca%5Bwght%5D.ttf" \
    d11c12298f431d7e416a1e615d33f2c2b98bda2318a0c186c8c94f08c2d90ce8 "$work/lexend.ttf"
fetch "$obel_zip" \
    789760993c70f01bcb25cb6db02457ebf77febd12078ab00085218e6d41b14df "$work/obel.zip"
fetch "$gf/manrope/OFL.txt" \
    58172e0c0fac2cda8a37b348164bb55e44b0e69051e557e92b1d3f6910141f7b "$out/OFL-manrope.txt"
fetch "$gf/lexenddeca/OFL.txt" \
    5da8505887d0fa7fe963445fd58852707fda34adfeb65af25c99d152bab285bd "$out/OFL-lexend-deca.txt"
fetch "https://typographic.systems/download/OFL.txt" \
    6fd1d5747b4d6988d19b4b2b0456fb16d567a0b4e9c4ec8008fbe489478b343e "$out/OFL-obel-mono.txt"

# The Obel archive ships a variable woff2; the instancer needs a TTF.
python3 - "$work/obel.zip" "$work/obel-vf.woff2" <<'PY'
import sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    open(sys.argv[2], "wb").write(z.read("ObelMono-1.002-woff2/ObelMono-VF.woff2"))
PY
python3 - "$work/obel-vf.woff2" "$work/obel.ttf" <<'PY'
import sys
from fontTools.ttLib import TTFont
f = TTFont(sys.argv[1])
f.flavor = None
f.save(sys.argv[2])
PY

cut() { # source weight unicodes features output
    fonttools varLib.instancer "$1" "wght=$2" -o "$work/instance.ttf" --quiet
    pyftsubset "$work/instance.ttf" --unicodes="$3" --layout-features="$4" \
        --flavor=woff2 --output-file="$5"
}

cut "$work/manrope.ttf" 400 "$ui_set" "$ui_features" "$out/manrope-400.woff2"
cut "$work/manrope.ttf" 600 "$ui_set" "$ui_features" "$out/manrope-600.woff2"
cut "$work/lexend.ttf" 200 "$ui_set" "$ui_features" "$out/lexend-deca-200.woff2"
cut "$work/obel.ttf" 400 "$mono_set" "$mono_features" "$out/obel-mono-400.woff2"

ls -l "$out"/*.woff2
