#!/bin/bash
# Daily Activity Bot - runs every 24 hours via cron
# Cron entry: 0 10 * * * /path/to/run-daily.sh >> /path/to/daily.log 2>&1

cd "$(dirname "$0")"

# Load private key from .env file
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

if [ -z "$MASTER_PRIVATE_KEY" ]; then
  echo "$(date): ERROR - MASTER_PRIVATE_KEY not set"
  exit 1
fi

echo ""
echo "============================================"
echo "  Cron trigger: $(date)"
echo "============================================"

npx tsx daily-runner.ts
