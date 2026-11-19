#!/usr/bin/env bash
# Saves the WordPress directory pages needed by harvest-directory.mjs, plus filtered/sorted variants used to test
# the Worker against WordPress (scripts/test-directory.mjs). Only works while the old WordPress site is up.
# Usage: scripts/fetch-directory-pages.sh <outdir>
set -euo pipefail
out=$1; mkdir -p "$out/variants"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"
get() { # url file
  local i
  for i in 1 2 3 4 5 6 7 8; do
    curl -sS -m 60 -A "$UA" -o "$2" "$1" < /dev/null || true
    if [ -s "$2" ] && ! grep -q "One moment, please\|415 Unsupported" "$2"; then echo "ok $1"; sleep 2; return; fi
    sleep $((i * 10))
  done
  echo "FAILED $1"; return 1
}
[ "${VARIANTS_ONLY:-}" = 1 ] || for n in $(seq 1 18); do get "https://nbasalaries.com/?directory_page=$n" "$out/home-p$n.html"; done
get "https://nbasalaries.com/teams/" "$out/teams.html"
queries=(
  "/?directory_page=2"
  "/?salary_sort=salary-asc"
  "/?salary_sort=name&directory_page=3"
  "/?salary_team=1126"
  "/?salary_group=Pacific&salary_position=G"
  "/?salary_sort=change-desc"
  "/?salary_sort=change-asc&salary_position=C"
  "/?salary_team=999999"
  "/?directory_page=99"
  "/teams/?salary_group=Eastern&salary_sort=change-desc"
  "/teams/?salary_sort=name"
  "/teams/?directory_page=2"
)
i=0
for q in "${queries[@]}"; do
  i=$((i+1)); get "https://nbasalaries.com$q" "$out/variants/$i.html"; echo "$q" > "$out/variants/$i.url"
done
get "https://nbasalaries.com/?s=curry" "$out/search-curry.html"
get "https://nbasalaries.com/?s=zzqqxx" "$out/search-none.html"
get "https://nbasalaries.com/wp-json/wp/v2/search?search=lebron&subtype=player,teams&per_page=8" "$out/live-lebron.json"
get "https://nbasalaries.com/wp-json/wp/v2/search?search=los&subtype=player,teams&per_page=8" "$out/live-los.json"
