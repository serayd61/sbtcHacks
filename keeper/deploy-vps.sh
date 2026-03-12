#!/bin/bash
# ============================================
# sBTC Vault Keeper — VPS Deploy Script
# ============================================
# Bu script'i VPS'te calistir:
#   curl -sL <raw-github-url> | bash
#   VEYA
#   scp deploy-vps.sh user@VPS_IP:~ && ssh user@VPS_IP 'bash deploy-vps.sh'
#
# Gereksinimler: Ubuntu/Debian, Node.js >= 20, git

set -euo pipefail

# ---- Config ----
APP_NAME="sbtc-keeper"
APP_DIR="/opt/$APP_NAME"
APP_USER="keeper"
REPO_URL="https://github.com/serayd61/sbtcHacks.git"
BRANCH="main"
SERVICE_FILE="/etc/systemd/system/$APP_NAME.service"
ENV_FILE="/opt/$APP_NAME/.env"

echo "╔══════════════════════════════════════╗"
echo "║  sBTC Vault Keeper — VPS Setup       ║"
echo "╚══════════════════════════════════════╝"
echo

# ---- Check root ----
if [ "$EUID" -ne 0 ]; then
  echo "Bu script root olarak calistirilmali:"
  echo "  sudo bash deploy-vps.sh"
  exit 1
fi

# ---- Check Node.js ----
if ! command -v node &>/dev/null; then
  echo "Node.js bulunamadi. Kuruluyor..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

NODE_VERSION=$(node -v)
echo "Node.js: $NODE_VERSION"

# ---- Create service user ----
if ! id "$APP_USER" &>/dev/null; then
  echo "Kullanici olusturuluyor: $APP_USER"
  useradd --system --no-create-home --shell /usr/sbin/nologin "$APP_USER"
fi

# ---- Clone / update repo ----
if [ -d "$APP_DIR" ]; then
  echo "Repo guncelleniyor..."
  cd "$APP_DIR"
  git fetch origin
  git reset --hard "origin/$BRANCH"
else
  echo "Repo klonlaniyor..."
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

# ---- Install dependencies ----
echo "Bagimliliklar kuruluyor..."
cd "$APP_DIR/keeper"
npm install --production

# ---- Create .env file (if not exists) ----
if [ ! -f "$ENV_FILE" ]; then
  echo "Env dosyasi olusturuluyor: $ENV_FILE"
  cat > "$ENV_FILE" << 'ENVEOF'
# sBTC Vault Keeper — Environment Variables
# ONEMLI: Bu dosyayi duzenle ve private key'ini ekle!

# Stacks wallet private key (64-char hex)
# Bu olmadan bot DRY RUN modunda calisir (TX gondermez)
KEEPER_PRIVATE_KEY=

# Keeper wallet adresi (bakiye izleme icin)
KEEPER_ADDRESS=

# Discord/Telegram webhook URL (opsiyonel, alert icin)
KEEPER_WEBHOOK_URL=
ENVEOF
  chmod 600 "$ENV_FILE"
  echo
  echo "  ⚠ ONEMLI: $ENV_FILE dosyasini duzenle ve KEEPER_PRIVATE_KEY ekle!"
  echo "    nano $ENV_FILE"
  echo
fi

# ---- Set permissions ----
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
# .env sadece owner okuyabilsin
chmod 600 "$ENV_FILE"

# ---- Create systemd service ----
echo "Systemd servisi olusturuluyor..."
cat > "$SERVICE_FILE" << SERVICEEOF
[Unit]
Description=sBTC Vault Keeper Bot
Documentation=https://github.com/serayd61/sbtcHacks
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$(which node) --import tsx keeper/index.ts
Restart=on-failure
RestartSec=30
StartLimitBurst=5
StartLimitIntervalSec=300

# Guvenlik ayarlari
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$APP_DIR
ProtectHome=true
PrivateTmp=true

# Log ayarlari
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$APP_NAME

# Kaynak limitleri
MemoryMax=512M
CPUQuota=50%

[Install]
WantedBy=multi-user.target
SERVICEEOF

# ---- Reload and enable ----
systemctl daemon-reload
systemctl enable "$APP_NAME"

echo
echo "╔══════════════════════════════════════╗"
echo "║  Kurulum tamamlandi!                 ║"
echo "╚══════════════════════════════════════╝"
echo
echo "  Sonraki adimlar:"
echo
echo "  1. Private key ekle:"
echo "     sudo nano $ENV_FILE"
echo
echo "  2. Servisi baslat:"
echo "     sudo systemctl start $APP_NAME"
echo
echo "  3. Loglari izle:"
echo "     sudo journalctl -u $APP_NAME -f"
echo
echo "  Diger komutlar:"
echo "     sudo systemctl stop $APP_NAME      # Durdur"
echo "     sudo systemctl restart $APP_NAME   # Yeniden baslat"
echo "     sudo systemctl status $APP_NAME    # Durum"
echo "     sudo journalctl -u $APP_NAME --since '1h ago'  # Son 1 saat log"
echo
