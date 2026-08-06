#!/usr/bin/env bash
#
# World Manager for Pterodactyl - installer
#
#   bash <(curl -sSL https://raw.githubusercontent.com/eloyvicent13-lgtm/worldmanager/main/install.sh)
#
# Environment overrides:
#   PANEL_DIR            panel root (default /var/www/pterodactyl)
#   WORLD_MANAGER_REPO   GitHub repository in owner/name form
#   WORLD_MANAGER_REF    branch or tag to install (default main)
#   SKIP_BUILD=1         skip the frontend rebuild (you must run it yourself)
#
set -euo pipefail

REPO="${WORLD_MANAGER_REPO:-eloyvicent13-lgtm/worldmanager}"
REF="${WORLD_MANAGER_REF:-main}"
PANEL_DIR="${PANEL_DIR:-/var/www/pterodactyl}"
STATE_DIR="${PANEL_DIR}/.world-manager"

RED=$'\e[31m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; BOLD=$'\e[1m'; RESET=$'\e[0m'

info()  { echo "${BOLD}==>${RESET} $*"; }
ok()    { echo "  ${GREEN}ok${RESET}   $*"; }
warn()  { echo "  ${YELLOW}warn${RESET} $*"; }
fail()  { echo "  ${RED}error${RESET} $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "run this as root (sudo)."
[ -f "${PANEL_DIR}/artisan" ] || fail "${PANEL_DIR} is not a Pterodactyl installation. Set PANEL_DIR."

for binary in php python3; do
    command -v "$binary" >/dev/null 2>&1 || fail "$binary is required but not installed."
done

# ---------------------------------------------------------------- source files

SOURCE_DIR=""
CLEANUP_DIR=""

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
if [ -n "$script_dir" ] && [ -d "${script_dir}/src/backend" ]; then
    SOURCE_DIR="$script_dir"
    info "Installing from local checkout: ${SOURCE_DIR}"
else
    command -v curl >/dev/null 2>&1 || fail "curl is required to download the addon."
    command -v tar >/dev/null 2>&1 || fail "tar is required to unpack the addon."

    CLEANUP_DIR="$(mktemp -d)"
    trap 'rm -rf "$CLEANUP_DIR"' EXIT

    info "Downloading ${REPO}@${REF}"
    fetch() {
        curl -fsSL "https://github.com/${REPO}/archive/refs/$1/${REF}.tar.gz" \
            | tar -xz -C "$CLEANUP_DIR" --strip-components=1 2>/dev/null
    }
    # WORLD_MANAGER_REF may be a branch or a release tag, so try both.
    fetch heads || fetch tags \
        || fail "download failed. Check WORLD_MANAGER_REPO and WORLD_MANAGER_REF."

    SOURCE_DIR="$CLEANUP_DIR"
    ok "downloaded"
fi

VERSION="$(cat "${SOURCE_DIR}/VERSION" 2>/dev/null || echo 'unknown')"

# ---------------------------------------------------------------- copy payload

info "Copying files into ${PANEL_DIR}"
mkdir -p "${STATE_DIR}"

rm -rf "${PANEL_DIR}/app/WorldManager" "${PANEL_DIR}/resources/scripts/worldmanager"
cp -r "${SOURCE_DIR}/src/backend/app/WorldManager" "${PANEL_DIR}/app/WorldManager"
cp -r "${SOURCE_DIR}/src/frontend" "${PANEL_DIR}/resources/scripts/worldmanager"
cp "${SOURCE_DIR}/src/backend/routes/worldmanager.php" "${PANEL_DIR}/routes/worldmanager.php"
cp "${SOURCE_DIR}/scripts/patch.py" "${STATE_DIR}/patch.py"
echo "$VERSION" > "${STATE_DIR}/version"
echo "$REPO" > "${STATE_DIR}/repo"
ok "files copied (version ${VERSION})"

# ------------------------------------------------------- compiled asset backup
#
# The rebuild is the only step that cannot be undone by restoring source files:
# themes that ship pre-built assets may not survive a plain `yarn build`. Keep a
# copy of whatever is currently served so an uninstall (or a failed build) can
# put the panel back exactly as it was.

ASSET_BACKUP="${STATE_DIR}/assets-backup"

backup_assets() {
    if [ -d "$ASSET_BACKUP" ]; then
        return 0
    fi

    # On an update the served assets already contain the addon, so they are not a
    # clean baseline; keeping them would make a later uninstall restore addon code.
    if grep -q "world-manager" "${PANEL_DIR}/routes/api-client.php" 2>/dev/null; then
        warn "panel already patched - skipping the asset backup, an uninstall will rebuild instead"
        return 0
    fi

    mkdir -p "$ASSET_BACKUP"
    for item in assets mix-manifest.json build; do
        if [ -e "${PANEL_DIR}/public/${item}" ]; then
            cp -r "${PANEL_DIR}/public/${item}" "${ASSET_BACKUP}/"
        fi
    done
    ok "saved a copy of the current compiled assets"
}

restore_assets() {
    if [ ! -d "$ASSET_BACKUP" ]; then
        return 1
    fi
    for item in assets mix-manifest.json build; do
        if [ -e "${ASSET_BACKUP}/${item}" ]; then
            rm -rf "${PANEL_DIR}/public/${item}"
            cp -r "${ASSET_BACKUP}/${item}" "${PANEL_DIR}/public/${item}"
        fi
    done
    return 0
}

info "Backing up compiled assets"
backup_assets

# -------------------------------------------------------------------- patching

info "Patching panel sources"
if ! python3 "${STATE_DIR}/patch.py" apply --panel "$PANEL_DIR"; then
    warn "one or more patches failed - see the messages above and README.md"
    python3 "${STATE_DIR}/patch.py" revert --panel "$PANEL_DIR" >/dev/null 2>&1 || true
    exit 1
fi

# --------------------------------------------------------------------- rebuild

rollback() {
    warn "rolling back: reverting patches and restoring the previous assets"
    python3 "${STATE_DIR}/patch.py" revert --panel "$PANEL_DIR" || true
    rm -rf "${PANEL_DIR}/app/WorldManager" "${PANEL_DIR}/resources/scripts/worldmanager"
    rm -f "${PANEL_DIR}/routes/worldmanager.php"
    restore_assets && ok "previous assets restored" || warn "no asset backup to restore"
    (cd "$PANEL_DIR" && php artisan optimize:clear >/dev/null 2>&1) || true
}

if [ "${SKIP_BUILD:-0}" != "1" ]; then
    if command -v yarn >/dev/null 2>&1; then
        info "Rebuilding the panel frontend (this takes a few minutes)"

        # Never run `yarn install`. The addon adds no dependencies - everything it
        # imports already ships with the panel - and reinstalling would prune any
        # package a theme installed outside package.json, breaking its build for
        # good. Only compile.
        if ! (cd "$PANEL_DIR" && NODE_OPTIONS="--max-old-space-size=4096" yarn build:production 2>&1 | tee "${STATE_DIR}/build.log"); then
            warn "build failed, last lines of ${STATE_DIR}/build.log:"
            tail -n 30 "${STATE_DIR}/build.log" >&2
            rollback
            fail "the frontend build failed. Your panel has been restored to its previous state."
        fi
        ok "assets rebuilt (log: ${STATE_DIR}/build.log)"
    else
        warn "yarn not found - the sidebar entry will not appear until you run 'yarn build:production' in ${PANEL_DIR}"
    fi
else
    warn "SKIP_BUILD=1 - remember to run 'yarn build:production' in ${PANEL_DIR}"
fi

info "Clearing caches"
(cd "$PANEL_DIR" && php artisan optimize:clear >/dev/null)
ok "caches cleared"

WEB_USER="$(stat -c '%U' "${PANEL_DIR}/storage" 2>/dev/null || echo www-data)"
chown -R "${WEB_USER}:${WEB_USER}" \
    "${PANEL_DIR}/app/WorldManager" \
    "${PANEL_DIR}/resources/scripts/worldmanager" \
    "${PANEL_DIR}/routes/worldmanager.php" \
    "${STATE_DIR}" 2>/dev/null || true

# ------------------------------------------------------------------- cli shim

cat > /usr/local/bin/world-manager <<EOF
#!/usr/bin/env bash
set -euo pipefail
PANEL_DIR="\${PANEL_DIR:-${PANEL_DIR}}"
REPO="\$(cat "\${PANEL_DIR}/.world-manager/repo" 2>/dev/null || echo '${REPO}')"

case "\${1:-help}" in
    version)   cat "\${PANEL_DIR}/.world-manager/version" ;;
    update)    bash <(curl -sSL "https://raw.githubusercontent.com/\${REPO}/main/install.sh") ;;
    uninstall) bash <(curl -sSL "https://raw.githubusercontent.com/\${REPO}/main/uninstall.sh") ;;
    *)         echo "usage: world-manager {version|update|uninstall}" ;;
esac
EOF
chmod +x /usr/local/bin/world-manager

echo
echo "${GREEN}${BOLD}World Manager ${VERSION} installed.${RESET}"
echo "  Open any Minecraft server in the panel - 'World Manager' now sits in the sidebar."
echo "  Manage it with: ${BOLD}world-manager update${RESET} / ${BOLD}world-manager uninstall${RESET}"
