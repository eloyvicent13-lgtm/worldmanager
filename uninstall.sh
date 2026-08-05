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

if [ "${SKIP_BUILD:-0}" != "1" ] && command -v yarn >/dev/null 2>&1; then
    info "Rebuilding the panel frontend"
    pushd "$PANEL_DIR" >/dev/null
    NODE_OPTIONS="--max-old-space-size=4096" yarn build:production
    popd >/dev/null
    ok "assets rebuilt"
else
    warn "run 'yarn build:production' in ${PANEL_DIR} to drop the sidebar entry from the compiled assets"
fi

(cd "$PANEL_DIR" && php artisan optimize:clear >/dev/null)
rm -rf "${STATE_DIR}"
rm -f /usr/local/bin/world-manager

echo
echo "${GREEN}${BOLD}World Manager removed.${RESET}"
echo "  Nothing inside your servers was touched; worlds and server.properties are untouched."
