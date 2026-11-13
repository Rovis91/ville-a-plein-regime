#!/bin/sh
# Capture sans écran : Chrome headless ouvre outils/captures.html et on attend captures/<carte>.json. Le serveur outils/capture.py doit tourner.
# Usage, depuis la racine : sh outils/capture.sh terre "pas=6"     ou     sh outils/capture.sh terre "idx=300,340&vue=90,12,4"     (PORT=8841 par défaut)
carte=$1; port=${PORT:-8841}; rm -f captures/$carte.json captures/$carte-*.jpg
"${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}" --headless=new --no-first-run --user-data-dir="${TEMP:-/tmp}/chr-$carte" --window-size=1000,700 --enable-unsafe-swiftshader --ignore-gpu-blocklist --remote-debugging-port=0 "http://127.0.0.1:$port/outils/captures.html?carte=$carte&$2" >/dev/null 2>&1 &
p=$!; i=0; while [ ! -f captures/$carte.json ] && [ $i -lt 120 ]; do sleep 2; i=$((i+1)); done; kill $p 2>/dev/null
[ -f captures/$carte.json ] && ls captures/$carte-*.jpg && grep -E '"(idx|erreurs|msParImage)"' captures/$carte.json | tr -d '\n' || { echo "ECHEC : pas de captures/$carte.json"; exit 1; }
