#!/bin/bash
# Deploy activity bot to Hetzner VPS
# Usage: ./deploy-vps.sh

VPS="root@188.245.241.149"
REMOTE_DIR="/opt/activity-bot"

echo "=== Deploying Activity Bot to VPS ==="

# 1. Rsync files (exclude .env, node_modules, wallets.json)
echo ""
echo "--- Step 1: Rsync files ---"
rsync -avz --progress \
  --exclude='.env' \
  --exclude='node_modules' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='wallet-balances.json' \
  --exclude='progress.json' \
  "$(dirname "$0")/" "${VPS}:${REMOTE_DIR}/"

# 2. Install dependencies on VPS
echo ""
echo "--- Step 2: Install dependencies ---"
ssh "$VPS" "cd ${REMOTE_DIR} && npm install"

# 3. Copy systemd files
echo ""
echo "--- Step 3: Setup systemd ---"
ssh "$VPS" "cp ${REMOTE_DIR}/activity-bot.service /etc/systemd/system/ && \
  cp ${REMOTE_DIR}/activity-bot.timer /etc/systemd/system/ && \
  systemctl daemon-reload && \
  systemctl enable activity-bot.timer && \
  systemctl start activity-bot.timer"

# 4. Show status
echo ""
echo "--- Status ---"
ssh "$VPS" "systemctl status activity-bot.timer --no-pager"

echo ""
echo "=== Deploy complete ==="
echo ""
echo "IMPORTANT: Set up .env on VPS:"
echo "  ssh ${VPS}"
echo "  echo 'MASTER_PRIVATE_KEY=your_key_here' > ${REMOTE_DIR}/.env"
echo ""
echo "wallets.json'u da kopyala (ilk seferde):"
echo "  scp wallets.json ${VPS}:${REMOTE_DIR}/"
echo ""
echo "Manual test:"
echo "  ssh ${VPS} 'systemctl start activity-bot.service'"
echo ""
echo "Loglar:"
echo "  ssh ${VPS} 'journalctl -u activity-bot.service -f'"
