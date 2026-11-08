#!/usr/bin/env bash
# Deploys bugnet.sh to the VPS as bugnet-website@<version> (data-plane 15.1, website plan 3).
#
#   deploy/website/deploy.sh [--dry-run] <ssh-host>
#
# It builds packages/site, uploads it as user bugnet with ~/.ssh/bugnet_deploy, starts the new
# version beside the running one, and stops the old one once the new one answers. --dry-run still
# builds and renders locally, then prints every remote command instead of running it.
set -euo pipefail

usage="usage: deploy.sh [--dry-run] <ssh-host>"
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo=$(cd "$here/../.." && pwd)
out=$repo/packages/site/out
key=$HOME/.ssh/bugnet_deploy
base=/opt/bugnet/website

die() {
    printf 'deploy.sh: %s\n' "$*" >&2
    exit 1
}

say() {
    printf 'deploy.sh: %s\n' "$*"
}

dry_run=false
host=""
for arg in "$@"; do
    case $arg in
        --dry-run) dry_run=true ;;
        -h | --help)
            echo "$usage"
            exit 0
            ;;
        -*) die "unknown flag $arg; $usage" ;;
        *)
            [[ -z $host ]] || die "$usage"
            host=$arg
            ;;
    esac
done
[[ -n $host ]] || die "$usage"
# The user is always bugnet, so the host is a name or an address, never user@host
[[ $host =~ ^[A-Za-z0-9._:-]+$ ]] || die "$host is not a host name or address"
$dry_run || [[ -f $key ]] || die "$key is missing (website plan 3, deploy key)"

if [[ -n $(git -C "$repo" status --porcelain) ]]; then
    $dry_run || die "the working tree has changes; commit them so the version names what ships"
    say "warning: the working tree has changes, which a real deploy refuses"
fi
version=$(date -u +%Y%m%dT%H%M%SZ)-$(git -C "$repo" rev-parse --short HEAD)

say "building packages/site for $version"
(cd "$repo" && pnpm --filter @bugnet/site build)
for f in index.html 404.html headers.caddy; do
    [[ -f $out/$f ]] || die "the build wrote no $out/$f"
done

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
bundle=$stage/upload/$version
mkdir -p "$bundle"
cp -R "$out" "$bundle/out"
# Caddy imports headers.caddy beside the Caddyfile; neither header file is a page to serve
mv "$bundle/out/headers.caddy" "$bundle/headers.caddy"
rm "$bundle/out/headers.txt"
sed "s|{{ROOT}}|$base/$version/out|g" "$here/Caddyfile.tmpl" >"$bundle/Caddyfile"
! grep -q '{{' "$bundle/Caddyfile" || die "the Caddyfile has a placeholder left"

# Runs on the VPS as bugnet, which has sudo; $1 is the version
cat >"$stage/remote.sh" <<'REMOTE'
set -euo pipefail
v=$1
base=/opt/bugnet/website
upload=$HOME/website-upload/$v
unit=bugnet-website@$v.service
keep=3
pattern='^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{7,}$'
probe=(curl -k -s --max-time 5 --resolve bugnet.sh:8446:127.0.0.1)
cd /

[[ $v =~ $pattern ]] || { echo "bad version $v" >&2; exit 1; }
[[ -d $upload ]] || { echo "$upload is missing" >&2; exit 1; }
[[ ! -e $base/$v ]] || { echo "$base/$v already exists" >&2; exit 1; }

sudo install -d -o root -g root -m 0755 "$base/$v"
sudo cp -R "$upload/." "$base/$v/"
sudo chown -R root:root "$base/$v"
sudo chmod -R u=rwX,go=rX "$base/$v"
rm -rf "$upload"

sudo -u bugnet-website env XDG_DATA_HOME=/var/lib/bugnet-website \
    XDG_CONFIG_HOME=/var/lib/bugnet-website \
    caddy validate --config "$base/$v/Caddyfile" --adapter caddyfile

mapfile -t previous < <(systemctl list-units --plain --no-legend --state=active \
    'bugnet-website@*.service' | awk '{print $1}')

# Old and new share 8446 until the old one stops, so a probe may reach either. It passes only
# on the new build's own home page, with its headers, and a 404 for a missing path.
healthy() {
    local head body code home=false
    systemctl is-active --quiet "$unit" || return 1
    head=$(mktemp) body=$(mktemp)
    code=$("${probe[@]}" -D "$head" -o "$body" -w '%{http_code}' https://bugnet.sh/) || code=000
    if [[ $code == 200 ]] && cmp -s "$body" "$base/$v/out/index.html" &&
        grep -qi '^content-security-policy: ' "$head"; then
        home=true
    fi
    rm -f "$head" "$body"
    $home || return 1
    code=$("${probe[@]}" -o /dev/null -w '%{http_code}' https://bugnet.sh/deploy-check-missing/) ||
        code=000
    [[ $code == 404 ]]
}

sudo systemctl start "$unit"
# The first deploy also waits for Let's Encrypt to issue the certificates
ok=false
for _ in $(seq 90); do
    if healthy; then
        ok=true
        break
    fi
    sleep 2
done
if ! $ok; then
    echo "$unit did not answer 200 on https://bugnet.sh/; stopping it, the old version stays" >&2
    sudo journalctl -u "$unit" -n 50 --no-pager >&2 || true
    sudo systemctl stop "$unit" || true
    sudo rm -rf "${base:?}/$v"
    exit 1
fi

sudo systemctl enable --quiet "$unit"
for old in "${previous[@]}"; do
    [[ $old == "$unit" ]] && continue
    sudo systemctl stop "$old"
    sudo systemctl disable --quiet "$old"
done

# Keep the newest $keep versions, by the timestamp each name starts with
mapfile -t versions < <(find "$base" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' |
    grep -E "$pattern" | sort)
for ((i = 0; i < ${#versions[@]} - keep; i++)); do
    old=${versions[i]}
    systemctl is-active --quiet "bugnet-website@$old.service" && continue
    sudo systemctl disable --quiet "bugnet-website@$old.service" || true
    sudo rm -rf "${base:?}/$old"
done
echo "bugnet-website@$v is live"
REMOTE

remote=bugnet@$host
ssh_opts=(-i "$key" -o IdentitiesOnly=yes -o BatchMode=yes)
upload=(rsync -rlt -e "ssh ${ssh_opts[*]}" "$stage/upload/" "$remote:website-upload/")
activate=(ssh "${ssh_opts[@]}" "$remote" bash -s -- "$version")

if $dry_run; then
    say "dry run: $version, nothing sent to $host"
    printf '\n# Caddyfile\n'
    cat "$bundle/Caddyfile"
    printf '\n# 1. upload, from the Mac\n'
    printf '%q ' "${upload[@]}"
    printf '\n\n# 2. activate, from the Mac, with the script below on stdin\n'
    printf '%q ' "${activate[@]}"
    printf '\n\n# Remote script, run as bugnet on %s for version %s\n' "$host" "$version"
    cat "$stage/remote.sh"
    exit 0
fi

say "uploading $version to $host"
"${upload[@]}"
say "starting bugnet-website@$version on $host"
"${activate[@]}" <"$stage/remote.sh"
say "done: bugnet-website@$version"
