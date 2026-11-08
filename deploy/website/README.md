# Deploying bugnet.sh

The site runs on the VPS as Caddy, one systemd instance per version, `bugnet-website@<version>`,
behind HAProxy's SNI split (data-plane 15.1 and 15.2, website plan section 3).

| What        | Where                                                                    |
| ----------- | ------------------------------------------------------------------------ |
| Unix user   | `bugnet-website` (system user, no shell, no home)                        |
| Files       | `/opt/bugnet/website/<version>`, owned by root, read-only to the service |
| Caddy state | `/var/lib/bugnet-website/caddy`: certificates and the ACME account key   |
| Listener    | `127.0.0.1:8446` only, PROXY v2 from HAProxy; no `:80`, admin API off    |
| Stats feeds | `/api/stats/payments*` to `127.0.0.1:8450`, `/api/stats*` to `:8082`     |

## Files

- `Caddyfile.tmpl`: the Caddy config. `deploy.sh` replaces `{{ROOT}}` with the version's `out/`.
  It imports `headers.caddy` from beside the rendered Caddyfile.
- `bugnet-website@.service`: the templated unit; `%i` is the version.
- `deploy.sh`: builds, uploads and switches versions (below).
- `packages/site/scripts/caddy-headers.ts`: run by the site's postbuild, it turns
  `out/headers.txt` into `out/headers.caddy`, so each page gets exactly its own CSP.

A version directory holds `Caddyfile`, `headers.caddy` and `out/`. Its name is the UTC build
time and the git short sha, such as `20261108T014521Z-1663c22`, so names sort by age.

## First time on the VPS

The router's setup already gives user `bugnet` the deploy key `~/.ssh/bugnet_deploy` and
passwordless sudo. HAProxy needs the `bugnet.sh` and `www.bugnet.sh` lines and `backend website`
(15.2), and DNS needs both A records (15.4), before the first deploy: the certificates come by
TLS-ALPN-01 through the split.

1. Install Caddy from its official apt repository, then turn off the package's own service,
   which would bind `:80` and `:443`:

    ```sh
    sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl rsync
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' |
        sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' |
        sudo tee /etc/apt/sources.list.d/caddy-stable.list
    sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg \
        /etc/apt/sources.list.d/caddy-stable.list
    sudo apt update && sudo apt install -y caddy
    sudo systemctl disable --now caddy && sudo systemctl mask caddy
    caddy version    # 2.8 or later, for handle_errors 404
    ```

2. Create the user and directories:

    ```sh
    sudo useradd --system --no-create-home --shell /usr/sbin/nologin bugnet-website
    sudo install -d -o root -g root -m 0755 /opt/bugnet/website
    sudo install -d -o bugnet-website -g bugnet-website -m 0700 /var/lib/bugnet-website
    ```

3. Install the unit, from the Mac:

    ```sh
    scp -i ~/.ssh/bugnet_deploy deploy/website/bugnet-website@.service bugnet@<host>:
    ssh -i ~/.ssh/bugnet_deploy bugnet@<host> \
        'sudo install -m 0644 bugnet-website@.service /etc/systemd/system/ &&
         rm bugnet-website@.service && sudo systemctl daemon-reload'
    ```

## Deploy

From a clean checkout on the Mac:

```sh
deploy/website/deploy.sh --dry-run <host>   # builds, then prints the Caddyfile and every remote command
deploy/website/deploy.sh <host>
```

The script builds `packages/site` and uploads the version to `~bugnet/website-upload/`. On the
host it copies it to `/opt/bugnet/website/<version>`, runs `caddy validate` as `bugnet-website`,
and starts the new unit beside the running one. It passes once
`curl -k --resolve bugnet.sh:8446:127.0.0.1 https://bugnet.sh/` answers 200 with the new build's
home page and a CSP header, and a missing path answers 404. Then it stops and disables the old
unit, enables the new one, and deletes all but the newest 3 versions. If the checks fail within
3 minutes, it stops the new unit, deletes its directory and leaves the old one running. The first
deploy spends part of that time getting the certificates.

Logs: `sudo journalctl -u 'bugnet-website@*'`.

## Roll back

On the VPS, as `bugnet`:

```sh
ls /opt/bugnet/website                       # the last 3 versions
systemctl list-units 'bugnet-website@*'      # the running one
sudo systemctl start bugnet-website@<older>
curl -k -s -o /dev/null -w '%{http_code}\n' --resolve bugnet.sh:8446:127.0.0.1 https://bugnet.sh/
sudo systemctl disable --now bugnet-website@<current>
sudo systemctl enable bugnet-website@<older>
```
