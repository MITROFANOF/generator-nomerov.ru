#!/bin/sh
# Publishes the site to the server that serves generator-nomerov.ru (the REG.RU VPS; Caddy config in the game repo,
# tools/car-serial-server/reserve/Caddyfile). Only the committed files of HEAD go out, never the working tree;
# .gitattributes keeps the repo's own files (this script, CNAME) out. Swaps the folder whole, so a visitor never
# sees half a deploy.
set -eu
host=${1:-31.31.207.158}
cd "$(dirname "$0")"
git diff --quiet HEAD -- . || echo "note: uncommitted changes are NOT published" >&2
git archive --format=tar HEAD | ssh -o BatchMode=yes root@"$host" '
  set -eu
  d=/var/www/generator-nomerov.ru
  rm -rf "$d.new" "$d.old"
  mkdir -p "$d.new"
  tar -x -C "$d.new"
  chmod -R u=rwX,go=rX "$d.new"
  if [ -d "$d" ]; then mv "$d" "$d.old"; fi
  mv "$d.new" "$d"
  rm -rf "$d.old"
  ls "$d"'
echo "published $(git rev-parse --short HEAD) to $host"
