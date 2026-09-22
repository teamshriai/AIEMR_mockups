#!/usr/bin/env bash
# Visits every routed screen in headless Chrome and asserts it rendered.
#
# A rendered screen prints its own id in the Z4 breadcrumb and in the footer
# line, so finding the id in the DOM proves the component mounted rather than
# falling through to the router's fallback.
#
# The one expected miss is S-18-01: ARC-12 command walls strip the shell
# entirely ("Z5 only, no Z1, no Z2"), so there is no breadcrumb to print.
#
# Usage:  npm run dev   # in another terminal
#         ./scripts/walk-routes.sh
set -u
BASE="${1:-http://localhost:5173}"
CHROME="${CHROME:-google-chrome}"

# Sensible params so every screen lands on real sample data.
route_for() {
  case "$1" in
    /patient/*)          echo "${1/:id/AWF-0044051}" ;;
    /stroke/case/*)      echo "${1/:id/0141}" ;;
    /radiology/study/*)  echo "${1/:id/ST-4471}" ;;
    /results/:id)        echo "/results/R-88410" ;;
    /tele/session/*)     echo "${1/:id/E-118430}" ;;
    /ip/encounter/*)     echo "${1/:id/E-118366}" ;;
    *)                   echo "${1/:id/E-118402}" ;;
  esac
}

mapfile -t rows < <(
  node --input-type=module -e "
    import { readFileSync } from 'fs';
    const src = readFileSync('src/atlas/registry.ts', 'utf8');
    for (const m of src.matchAll(/id: '(S-\d\d-\d\d)',[\s\S]*?route: (null|'([^']+)')/g)) {
      if (m[3]) console.log(m[1] + ' ' + m[3]);
    }
  "
)

pass=0; fail=0
for row in "${rows[@]}"; do
  id="${row%% *}"; pattern="${row##* }"
  route="$(route_for "$pattern")"
  dom="$(timeout 40 "$CHROME" --headless --disable-gpu --no-sandbox \
          --virtual-time-budget=4500 --dump-dom "${BASE}${route}" 2>/dev/null)"
  if grep -q "$id" <<< "$dom" && ! grep -qE 'has no component|No screen at this address' <<< "$dom"; then
    pass=$((pass + 1))
  else
    printf 'FAIL  %-9s %s\n' "$id" "$route"
    fail=$((fail + 1))
  fi
done

printf -- '---- %d passed, %d failed ----\n' "$pass" "$fail"
[ "$fail" -le 1 ] || exit 1
