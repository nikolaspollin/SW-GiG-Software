#!/usr/bin/env bash
# Renders every Mermaid class diagram (docs/uml/<story>/src/*.mmd) to a PNG next to its src folder.
# Requires Node.js >= 22.13. Uses an installed Chrome if PUPPETEER_EXECUTABLE_PATH is set,
# otherwise Puppeteer downloads its own browser on first run.
#   ./docs/uml/render.sh            # all stories
#   ./docs/uml/render.sh US17       # one story
set -euo pipefail

cd "$(dirname "$0")"
MMDC_VERSION="12.0.0"
stories=("${@:-*}")

for story in ${stories[@]}; do
  for src in "$story"/src/*.mmd; do
    [ -e "$src" ] || continue
    out="$(dirname "$(dirname "$src")")/$(basename "$src" .mmd).png"
    echo "Rendering $src -> $out"
    # Headless Chrome occasionally fails to start; retry a few times before giving up.
    for attempt in 1 2 3; do
      if npx -y "@mermaid-js/mermaid-cli@$MMDC_VERSION" -q \
           -i "$src" -o "$out" -s 2 -b white \
           -c mermaid-config.json -p puppeteer-config.json; then
        break
      fi
      [ "$attempt" -lt 3 ] || { echo "Failed to render $src" >&2; exit 1; }
      echo "Retrying $src ($attempt/3 failed)"
    done
  done
done
