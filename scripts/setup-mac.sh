#!/usr/bin/env bash
# Richtet "Fertigung Einfach" lokal auf einem Mac ein.
# Aufruf im Projektordner:  bash scripts/setup-mac.sh
# Kann gefahrlos mehrfach ausgeführt werden.
set -euo pipefail

cd "$(dirname "$0")/.."
DB_NAME="fertigung"
DB_USER="fertigung"

say() { printf "\n\033[1m▶ %s\033[0m\n" "$1"; }

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Dieses Skript ist für macOS gedacht." >&2
  exit 1
fi

say "Homebrew prüfen"
if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew fehlt. Bitte zuerst installieren (https://brew.sh) und das Skript erneut starten." >&2
  exit 1
fi

say "Node.js, pnpm und MySQL installieren (falls nötig)"
command -v node >/dev/null 2>&1 || brew install node
command -v pnpm >/dev/null 2>&1 || brew install pnpm
brew list mysql >/dev/null 2>&1 || brew install mysql
brew services start mysql >/dev/null
for _ in {1..30}; do mysqladmin ping --silent 2>/dev/null && break; sleep 1; done

say "Abhängigkeiten installieren"
pnpm install

if [[ -f .env ]] && grep -q '^DATABASE_URL=' .env; then
  say ".env existiert bereits – Datenbank-Zugang wird beibehalten"
else
  say "Lokale Datenbank und .env anlegen"
  DB_PASS="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)"
  mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
  cat > .env <<ENV
DATABASE_URL=mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}
PORT=3000
UPLOAD_DIR=./uploads
ENV
  chmod 600 .env
fi

say "Migrationen anwenden"
pnpm db:migrate

say "Prüfungen"
pnpm check
pnpm test

COUNT="$(mysql -u root -N -e "SELECT COUNT(*) FROM \`${DB_NAME}\`.kiosk_users" 2>/dev/null || echo 0)"
if [[ "$COUNT" == "0" ]]; then
  say "Ersten Koordinator anlegen"
  read -r -p "Kürzel (z. B. vincent): " LOGIN
  read -r -p "Anzeigename (z. B. Vincent): " NAME
  pnpm -s admin:create-coordinator --login "$LOGIN" --name "$NAME" --companies 1,2
else
  say "Es gibt schon Personen – kein neuer Koordinator nötig"
fi

say "Fertig"
echo "Starten mit:   pnpm dev"
echo "Dann im Browser öffnen:   http://localhost:3000"
echo "Vom iPhone im selben WLAN:   http://$(ipconfig getifaddr en0 2>/dev/null || echo '<IP-des-Mac>'):3000"
