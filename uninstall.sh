#!/usr/bin/env bash
#
# World Manager for Pterodactyl - uninstaller
#
#   world-manager uninstall
#   bash <(curl -sSL https://raw.githubusercontent.com/eloyvicent13-lgtm/worldmanager/main/uninstall.sh)
#
set -euo pipefail

PANEL_DIR="${PANEL_DIR:-/var/www/pterodactyl}"
STATE_DIR="${PANEL_DIR}/.world-manager"

RED=$'\e[31m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; BOLD=$'\e[1m'; RESET=$'\e[0m'

info() { echo "${BOLD}==>${RESET} $*"; }
ok()   { echo "  ${GREEN}ok${RESET}   $*"; }
warn() { echo "  ${YELLOW}warn${RESET} $*"; }
fail() { echo "  ${RED}error${RESET} $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "run this as root (sudo)."
[ -f "${PANEL_DIR}/artisan" ] || fail "${PANEL_DIR} is not a Pterodactyl installation. Set PANEL_DIR."

info "Reverting panel source patches"
if [ -f "${STATE_DIR}/patch.py" ]; then
    python3 "${STATE_DIR}/patch.py" revert --panel "$PANEL_DIR"
else
    warn "patch.py is missing; remove the '// world-manager' lines from"
    warn "routes/api-client.php, resources/scripts/routers/routes.ts and ServerRouter.tsx by hand."
fi

info "Removing addon files"
rm -rf "${PANEL_DIR}/app/WorldManager"
rm -rf "${PANEL_DIR}/resources/scripts/worldmanager"
rm -f "${PANEL_DIR}/routes/worldmanager.php"
ok "files removed"

# Restoring the assets captured before the install is exact and instant; a
# rebuild is only a fallback for installs made before asset backups existed.
ASSET_BACKUP="${STATE_DIR}/assets-backup"

if [ -d "$ASSET_BACKUP" ]; then
    info "Restoring the compiled assets from before the install"
    for item in assets mix-manifest.json build; do
        if [ -e "${ASSET_BACKUP}/${item}" ]; then
            rm -rf "${PANEL_DIR}/public/${item}"
            cp -r "${ASSET_BACKUP}/${item}" "${PANEL_DIR}/public/${item}"
        fi
    done
    ok "assets restored"
elif [ "${SKIP_BUILD:-0}" != "1" ] && command -v yarn >/dev/null 2>&1; then
    info "No asset backup found, rebuilding the panel frontend instead"
    if (cd "$PANEL_DIR" && NODE_OPTIONS="--max-old-space-size=4096" yarn build:production); then
        ok "assets rebuilt"
    else
        warn "the rebuild failed - the panel sources are clean, but the served assets are still the old ones"
        warn "reinstall your theme, or run 'yarn build:production' in ${PANEL_DIR} once the build works"
    fi
else
    warn "run 'yarn build:production' in ${PANEL_DIR} to drop the sidebar entry from the compiled assets"
fi

WEB_USER="$(stat -c '%U' "${PANEL_DIR}/storage" 2>/dev/null || echo www-data)"
chown -R "${WEB_USER}:${WEB_USER}" "${PANEL_DIR}/public" 2>/dev/null || true

(cd "$PANEL_DIR" && php artisan optimize:clear >/dev/null)
rm -rf "${STATE_DIR}"
rm -f /usr/local/bin/world-manager

echo
echo "${GREEN}${BOLD}World Manager removed.${RESET}"
echo "  Nothing inside your servers was touched; worlds and server.properties are untouched."
