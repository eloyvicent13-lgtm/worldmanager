#!/usr/bin/env python3
"""Applies and reverts the World Manager source patches on a Pterodactyl panel.

Every patch is guarded by a marker, so running `apply` twice is a no-op, and a
pristine copy of each touched file is stored under <panel>/.world-manager/backup
before the first modification so `revert` can always put things back.
"""

import argparse
import os
import re
import shutil
import sys

MARKER = "world-manager"
BACKUP_DIR = os.path.join(".world-manager", "backup")

ROUTES_BLOCK = """
// world-manager:start -- added by the World Manager addon, do not edit by hand
Route::group([
    'prefix' => '/servers/{server}/world-manager',
    'middleware' => [
        ServerSubject::class,
        AuthenticateServerAccess::class,
        ResourceBelongsToServer::class,
    ],
], base_path('routes/worldmanager.php'));
// world-manager:end
"""

ROUTE_ENTRY = """        // world-manager:start
        {
            path: '/world-manager',
            permission: 'file.*',
            name: 'World Manager',
%s            component: WorldManagerContainer,
        },
        // world-manager:end
"""

ROUTES_IMPORT = "import WorldManagerContainer from '@/worldmanager/WorldManagerContainer'; // world-manager"
ICON_IMPORT = "import { faGlobe } from '@fortawesome/free-solid-svg-icons'; // world-manager"
GUARD_IMPORT = "import WorldManagerGuard from '@/worldmanager/WorldManagerGuard'; // world-manager"
GUARD_ELEMENT = "<WorldManagerGuard />{/* world-manager */}"

# Anchors tried in order; themes rename things, so more than one shot is needed.
GUARD_ANCHORS = ["<WebsocketHandler />", "<InstallListener />", "<TransferListener />", "<SubNavigation>"]


class PatchError(Exception):
    pass


def read(path):
    # newline="" keeps the file's own line endings intact instead of rewriting
    # the whole file the moment a single line is inserted.
    with open(path, "r", encoding="utf-8", newline="") as handle:
        return handle.read()


def write(path, contents):
    with open(path, "w", encoding="utf-8", newline="") as handle:
        handle.write(contents)


def backup(panel, relative):
    target = os.path.join(panel, BACKUP_DIR, relative)
    if os.path.exists(target):
        return
    os.makedirs(os.path.dirname(target), exist_ok=True)
    shutil.copy2(os.path.join(panel, relative), target)


def restore(panel, relative):
    source = os.path.join(panel, BACKUP_DIR, relative)
    if not os.path.exists(source):
        return False
    shutil.copy2(source, os.path.join(panel, relative))
    return True


def insert_after_imports(contents, line):
    matches = list(re.finditer(r"^import .*?;\s*$", contents, re.MULTILINE))
    if not matches:
        return line + "\n" + contents
    end = matches[-1].end()
    return contents[:end] + "\n" + line + contents[end:]


def patch_api_routes(panel):
    relative = os.path.join("routes", "api-client.php")
    path = os.path.join(panel, relative)
    contents = read(path)

    if MARKER in contents:
        return "already patched"

    backup(panel, relative)
    write(path, contents.rstrip("\n") + "\n" + ROUTES_BLOCK)
    return "patched"


def patch_routes_ts(panel):
    relative = os.path.join("resources", "scripts", "routers", "routes.ts")
    path = os.path.join(panel, relative)
    contents = read(path)

    if MARKER in contents:
        return "already patched"

    if not re.search(r"^\s*server:\s*\[\s*$", contents, re.MULTILINE):
        raise PatchError(
            "could not find the 'server: [' route list in routes.ts. "
            "Add the World Manager entry by hand, see README.md."
        )

    # Themes that draw an icon next to every sidebar entry add an `icon` field to
    # the route definition and render it unconditionally. Leaving it out makes the
    # icon component throw, which takes down the whole server view, so match the
    # shape the file already uses.
    note = ""
    icon_line = ""
    if re.search(r"^\s*icon:\s*\S", contents, re.MULTILINE):
        if not re.search(r"^\s*icon:\s*fa[A-Z]\w*", contents, re.MULTILINE):
            raise PatchError(
                "routes.ts gives every route an 'icon' that is not a FontAwesome "
                "definition, so the right value cannot be guessed. Add the World "
                "Manager entry by hand using the same icon style, see README.md."
            )
        icon_line = "            icon: faGlobe,\n"
        note = " with a FontAwesome icon"

    backup(panel, relative)
    contents = insert_after_imports(contents, ROUTES_IMPORT)
    if icon_line and "faGlobe" not in contents:
        contents = insert_after_imports(contents, ICON_IMPORT)

    entry = ROUTE_ENTRY % icon_line

    # Preferred: append as the last server route so it lands at the bottom of the
    # sidebar. Falls back to the top of the list on themes that restructured the file.
    tail = re.search(r"^\s*\],\s*\n\}\s*as Routes;", contents, re.MULTILINE)
    if tail:
        write(path, contents[: tail.start()] + entry + contents[tail.start() :])
        return "patched" + note

    head = re.search(r"^\s*server:\s*\[\s*$", contents, re.MULTILINE)
    write(path, contents[: head.end() + 1] + entry + contents[head.end() + 1 :])
    return "patched%s (inserted at the top of the list)" % note


def patch_server_router(panel):
    relative = os.path.join("resources", "scripts", "routers", "ServerRouter.tsx")
    path = os.path.join(panel, relative)
    contents = read(path)

    if MARKER in contents:
        return "already patched"

    anchor = next((a for a in GUARD_ANCHORS if a in contents), None)
    if anchor is None:
        raise PatchError(
            "no known mount point found in ServerRouter.tsx. The addon still works, "
            "but the sidebar entry will show on every server. See README.md for the manual patch."
        )

    backup(panel, relative)
    contents = insert_after_imports(contents, GUARD_IMPORT)
    contents = contents.replace(anchor, anchor + "\n                    " + GUARD_ELEMENT, 1)
    write(path, contents)
    return "patched (anchor: %s)" % anchor


def strip_markers(contents):
    contents = re.sub(
        r"\n?[^\n]*//\s*world-manager:start.*?//\s*world-manager:end[^\n]*", "", contents, flags=re.DOTALL
    )
    contents = re.sub(r"^.*//\s*world-manager\s*$\n?", "", contents, flags=re.MULTILINE)
    contents = re.sub(r"^.*\{/\*\s*world-manager\s*\*/\}.*$\n?", "", contents, flags=re.MULTILINE)

    # Removing a block can leave a double blank line behind.
    newline = "\r\n" if "\r\n" in contents else "\n"
    contents = re.sub(r"(?:\r?\n){3,}", newline * 2, contents)

    return contents.rstrip("\r\n") + newline


def revert(panel):
    results = []
    for relative in (
        os.path.join("routes", "api-client.php"),
        os.path.join("resources", "scripts", "routers", "routes.ts"),
        os.path.join("resources", "scripts", "routers", "ServerRouter.tsx"),
    ):
        path = os.path.join(panel, relative)
        if not os.path.exists(path):
            continue

        if restore(panel, relative):
            results.append("%s: restored from backup" % relative)
            continue

        contents = read(path)
        if MARKER not in contents:
            results.append("%s: nothing to do" % relative)
            continue

        write(path, strip_markers(contents))
        results.append("%s: markers removed (no backup found)" % relative)

    return results


def main():
    parser = argparse.ArgumentParser(description="World Manager panel patcher")
    parser.add_argument("action", choices=["apply", "revert"])
    parser.add_argument("--panel", default="/var/www/pterodactyl")
    parser.add_argument("--allow-partial", action="store_true", help="keep going when an anchor is missing")
    args = parser.parse_args()

    panel = os.path.abspath(args.panel)
    if not os.path.isfile(os.path.join(panel, "artisan")):
        print("error: %s does not look like a Pterodactyl installation" % panel, file=sys.stderr)
        return 1

    if args.action == "revert":
        for line in revert(panel):
            print("  " + line)
        return 0

    failures = 0
    for name, handler in (
        ("routes/api-client.php", patch_api_routes),
        ("resources/scripts/routers/routes.ts", patch_routes_ts),
        ("resources/scripts/routers/ServerRouter.tsx", patch_server_router),
    ):
        try:
            print("  %s: %s" % (name, handler(panel)))
        except PatchError as error:
            failures += 1
            print("  %s: FAILED - %s" % (name, error), file=sys.stderr)

    if failures and not args.allow_partial:
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
