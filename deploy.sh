#!/bin/sh
# Publish the page to both homes: GitHub Pages (acwave25.github.io/depth) and the Cloudflare
# custom domain (maps.waveadvisors.uk).
set -e
cd "$(dirname "$0")"
cp index.html extremes-points.js dhn-sheets.js power-plants.json public/
git push origin main
wrangler deploy
