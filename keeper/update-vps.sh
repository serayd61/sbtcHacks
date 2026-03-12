#!/bin/bash
# ============================================
# sBTC Vault Keeper — VPS Update Script
# ============================================
# Kullanim: sudo bash /opt/sbtc-keeper/keeper/update-vps.sh

set -euo pipefail

APP_NAME="sbtc-keeper"
APP_DIR="/opt/$APP_NAME"

if [ "$EUID" -ne 0 ]; then
  echo "Root gerekli: sudo bash $0"
  exit 1
fi

echo "[update] Keeper durduruluyor..."
systemctl stop "$APP_NAME" 2>/dev/null || true

echo "[update] Kod guncelleniyor..."
cd "$APP_DIR"
git fetch origin
git reset --hard origin/main

echo "[update] Bagimliliklar guncelleniyor..."
cd "$APP_DIR/keeper"
npm install --production

echo "[update] Izinler ayarlaniyor..."
chown -R keeper:keeper "$APP_DIR"

echo "[update] Keeper baslatiliyor..."
systemctl start "$APP_NAME"

echo "[update] Durum:"
systemctl status "$APP_NAME" --no-pager -l
echo
echo "Loglar: sudo journalctl -u $APP_NAME -f"
