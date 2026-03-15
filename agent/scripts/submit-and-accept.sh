#!/bin/bash
# Submit tweets, wait for voting period, then resolve + sync.
# Usage: ./scripts/submit-and-accept.sh
set -e

cd "$(dirname "$0")/.."

echo "=== Submitting tweets ==="
bun run cli submit "https://x.com/VitalikButerin/status/1900153953023062101" crypto

echo ""
echo "=== Waiting for voting period to expire ==="
echo "Started at: $(date)"
sleep 70

echo ""
echo "=== Resolving all expired voting items ==="
bun run scripts/accept-items.ts

echo ""
echo "=== Triggering sync ==="
curl -s "https://newsworthy-api.bflynn4141.workers.dev/sync" | python3 -m json.tool

echo ""
echo "=== Verifying feed ==="
curl -s "https://newsworthy-api.bflynn4141.workers.dev/public/feed" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'  Total: {d[\"total\"]}')"

echo ""
echo "Done!"
