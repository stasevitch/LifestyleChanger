#!/usr/bin/env bash
# Rebuilds public/vendor/anthropic-sdk-<version>.js: the official Anthropic SDK bundled as one browser ES module.
# Usage: ./vendor-sdk.sh 1.7.0   (then update SDK_URL in src/app.html and SHELL in public/sw.js)
set -euo pipefail
V="${1:?sdk version}"; HERE="$(cd "$(dirname "$0")" && pwd)"; T="$(mktemp -d)"
cd "$T" && npm init -y >/dev/null && npm i -q "@anthropic-ai/sdk@$V" esbuild@0.24.2
echo 'export { default } from "@anthropic-ai/sdk"; export * from "@anthropic-ai/sdk";' > entry.mjs
npx esbuild entry.mjs --bundle --format=esm --platform=browser --minify --legal-comments=eof --outfile="$HERE/public/vendor/anthropic-sdk-$V.js"
rm -rf "$T"
