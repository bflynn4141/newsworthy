#!/bin/bash
# Submit 6 tweets (3 per wallet), wait 31 min for voting period, then resolve + sync.
# Usage: ./scripts/submit-and-accept.sh
set -e

cd "$(dirname "$0")/.."

echo "=== Batch 1: Deployer (3 crypto tweets) ==="
bun run scripts/submit-categorized.ts deployer

echo ""
echo "=== Batch 2: Migrator (3 AI tweets) ==="
bun run scripts/submit-categorized.ts migrator

echo ""
echo "=== Waiting 31 minutes for voting period to expire ==="
echo "Started at: $(date)"
echo "Will resume at: $(date -v+31M 2>/dev/null || date -d '+31 minutes')"
sleep 1860

echo ""
echo "=== Resolving all expired voting items ==="
bun run scripts/accept-items.ts

echo ""
echo "=== Triggering sync ==="
curl -s "https://newsworthy-api.bflynn4141.workers.dev/sync" | python3 -m json.tool

echo ""
echo "=== Verifying feed ==="
echo "All:"
curl -s "https://newsworthy-api.bflynn4141.workers.dev/public/feed" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'  Total: {d[\"total\"]}')"
echo "Crypto:"
curl -s "https://newsworthy-api.bflynn4141.workers.dev/public/feed?category=crypto" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'  Total: {d[\"total\"]}')"
echo "AI:"
curl -s "https://newsworthy-api.bflynn4141.workers.dev/public/feed?category=ai" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'  Total: {d[\"total\"]}')"

echo ""
echo "Done! Check https://web-ashen-nine-37.vercel.app"
