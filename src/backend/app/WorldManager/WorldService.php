<?php

namespace Pterodactyl\WorldManager;

use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Pterodactyl\Models\User;
use Pterodactyl\Models\Server;
use Pterodactyl\Services\Nodes\NodeJWTService;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Repositories\Wings\DaemonServerRepository;
use Pterodactyl\Exceptions\DisplayException;

/**
 * All world level operations. Everything talks to Wings through the same
 * repositories the stock file manager uses, so no extra daemon endpoints or
 * permissions are required.
 */
class WorldService
{
    /** Scratch directory used for archives and uploads. */
    public const WORK_DIR = '.world-manager';

    public const PROPERTIES_FILE = '/server.properties';

    /** Directories that are never worlds, skipped before probing for level.dat. */
    private const IGNORED_DIRECTORIES = [
        'plugins', 'mods', 'config', 'logs', 'cache', 'libraries', 'versions', 'crash-reports',
        'bin', 'defaultconfigs', 'kubejs', 'local', 'scripts', 'resourcepacks', 'datapacks',
        'server-icon', 'backups', 'plugin', 'behavior_packs', 'resource_packs', 'worlds_backup',
    ];

    /** Settings exposed by the UI. Everything else in server.properties is left alone. */
    public const EDITABLE_SETTINGS = [
        'gamemode', 'difficulty', 'hardcore', 'pvp', 'force-gamemode', 'allow-flight',
        'allow-nether', 'generate-structures', 'spawn-animals', 'spawn-monsters', 'spawn-npcs',
        'spawn-protection', 'view-distance', 'simulation-distance', 'max-players',
        'level-seed', 'level-type', 'motd', 'online-mode', 'enable-command-block',
        'player-idle-timeout', 'max-world-size', 'white-list',
    ];

    public function __construct(
        private DaemonFileRepository $fileRepository,
        private DaemonServerRepository $serverRepository,
        private NodeJWTService $jwtService,
    ) {
    }

    // ---------------------------------------------------------------- worlds

    /**
     * Returns every world folder in the server root together with its extra
     * dimensions and whether it is the world currently loaded by the server.
     *
     * @return array<int, array<string, mixed>>
     */
    public function worlds(Server $server): array
    {
        $entries = $this->fileRepository->setServer($server)->getDirectory('/');
        $active = $this->activeWorldName($server);

        $directories = [];
        foreach ($entries as $entry) {
            $name = $entry['name'] ?? '';
            if (!($entry['directory'] ?? false) || $name === '' || str_starts_with($name, '.')) {
                continue;
            }
            if (in_array(strtolower($name), self::IGNORED_DIRECTORIES, true)) {
                continue;
            }
            $directories[$name] = $entry;
        }

        // Dimension folders belong to their parent world, do not probe them separately.
        $dimensionOf = [];
        foreach (array_keys($directories) as $name) {
            foreach (['_nether' => 'nether', '_the_end' => 'the_end'] as $suffix => $dimension) {
                if (str_ends_with($name, $suffix) && isset($directories[substr($name, 0, -strlen($suffix))])) {
                    $dimensionOf[$name] = [substr($name, 0, -strlen($suffix)), $dimension];
                }
            }
        }

        $worlds = [];
        $probed = 0;
        foreach ($directories as $name => $entry) {
            if (isset($dimensionOf[$name]) || $probed >= 60) {
                continue;
            }

            ++$probed;
            if (!$this->looksLikeWorld($server, $name)) {
                continue;
            }

            $dimensions = ['overworld'];
            foreach ($dimensionOf as $child => [$parent, $dimension]) {
                if ($parent === $name) {
                    $dimensions[] = $dimension;
                }
            }

            $worlds[] = [
                'name' => $name,
                'active' => $name === $active,
                'dimensions' => $dimensions,
                'modified_at' => $entry['modified'] ?? null,
            ];
        }

        usort($worlds, fn ($a, $b) => ($b['active'] <=> $a['active']) ?: strcasecmp($a['name'], $b['name']));

        return $worlds;
    }

    /**
     * Every folder that makes up a world: the overworld plus its dimensions.
     *
     * @return array<int, string>
     */
    public function worldFolders(Server $server, string $name): array
    {
        $folders = [$name];
        $existing = [];
        foreach ($this->fileRepository->setServer($server)->getDirectory('/') as $entry) {
            if ($entry['directory'] ?? false) {
                $existing[] = $entry['name'];
            }
        }

        foreach (['_nether', '_the_end'] as $suffix) {
            if (in_array($name . $suffix, $existing, true)) {
                $folders[] = $name . $suffix;
            }
        }

        return $folders;
    }

    public function activeWorldName(Server $server): string
    {
        return $this->properties($server)->get('level-name', 'world') ?: 'world';
    }

    /**
     * Points level-name at another world. Minecraft only reads this on boot.
     */
    public function activate(Server $server, string $name): void
    {
        $this->assertWorldExists($server, $name);
        $this->writeProperties($server, $this->properties($server)->set('level-name', $name));
    }

    public function delete(Server $server, string $name): void
    {
        $this->assertWorldExists($server, $name);

        if ($this->activeWorldName($server) === $name) {
            throw new DisplayException('The active world cannot be deleted. Activate another world first, or use reset instead.');
        }

        $this->fileRepository->setServer($server)->deleteFiles('/', $this->worldFolders($server, $name));
    }

    /**
     * Wipes the world folders but leaves level-name alone so the server
     * regenerates a fresh world on the next boot.
     */
    public function reset(Server $server, string $name, ?string $seed = null): void
    {
        $this->assertWorldExists($server, $name);
        $this->fileRepository->setServer($server)->deleteFiles('/', $this->worldFolders($server, $name));

        if ($seed !== null) {
            $this->writeProperties($server, $this->properties($server)->set('level-seed', $seed));
        }
    }

    public function duplicate(Server $server, string $name, string $target): string
    {
        $this->assertWorldExists($server, $name);
        $target = $this->sanitiseName($target);
        $this->assertNameAvailable($server, $target);

        $repository = $this->fileRepository->setServer($server);
        foreach ($this->worldFolders($server, $name) as $folder) {
            $suffix = substr($folder, strlen($name));

            $repository->copyFile('/' . $folder);
            // Wings names copies "<folder> copy"; move it to the requested name.
            $repository->renameFiles('/', [['from' => $folder . ' copy', 'to' => $target . $suffix]]);
        }

        return $target;
    }

    public function rename(Server $server, string $name, string $target): string
    {
        $this->assertWorldExists($server, $name);
        $target = $this->sanitiseName($target);
        $this->assertNameAvailable($server, $target);

        $renames = [];
        foreach ($this->worldFolders($server, $name) as $folder) {
            $renames[] = ['from' => $folder, 'to' => $target . substr($folder, strlen($name))];
        }

        $this->fileRepository->setServer($server)->renameFiles('/', $renames);

        if ($this->activeWorldName($server) === $name) {
            $this->writeProperties($server, $this->properties($server)->set('level-name', $target));
        }

        return $target;
    }

    // ------------------------------------------------------------- download

    /**
     * Archives a world and returns a short lived Wings download URL.
     */
    public function downloadUrl(Server $server, User $user, string $name): string
    {
        $this->assertWorldExists($server, $name);

        $repository = $this->fileRepository->setServer($server);
        $this->prepareWorkDirectory($server);

        set_time_limit(0);
        $archive = $repository->compressFiles('/', $this->worldFolders($server, $name));
        $created = $archive['name'] ?? ($archive['attributes']['name'] ?? null);
        if (!$created) {
            throw new DisplayException('Wings did not return an archive name; the world could not be packaged.');
        }

        $file = sprintf('%s-%s.tar.gz', $this->sanitiseName($name), CarbonImmutable::now()->format('Ymd-His'));
        $repository->renameFiles('/', [['from' => $created, 'to' => self::WORK_DIR . '/' . $file]]);

        $token = $this->jwtService
            ->setExpiresAt(CarbonImmutable::now()->addMinutes(15))
            ->setUser($user)
            ->setClaims([
                'file_path' => '/' . self::WORK_DIR . '/' . $file,
                'server_uuid' => $server->uuid,
            ])
            ->handle($server->node, $user->id . $server->uuid);

        return sprintf('%s/download/file?token=%s', $server->node->getConnectionAddress(), $token->toString());
    }

    // --------------------------------------------------------------- upload

    /**
     * Signed Wings URL the browser uploads the archive straight to, so the
     * panel never has to buffer a multi gigabyte world.
     */
    public function uploadUrl(Server $server, User $user): string
    {
        $this->prepareWorkDirectory($server);

        $token = $this->jwtService
            ->setExpiresAt(CarbonImmutable::now()->addMinutes(60))
            ->setUser($user)
            ->setClaims(['server_uuid' => $server->uuid])
            ->handle($server->node, $user->id . $server->uuid);

        return sprintf('%s/upload/file?token=%s', $server->node->getConnectionAddress(), $token->toString());
    }

    /**
     * Unpacks an uploaded archive and installs it as a world.
     */
    public function import(Server $server, string $file, ?string $name = null): string
    {
        $file = basename($file);
        $repository = $this->fileRepository->setServer($server);

        $stage = self::WORK_DIR . '/import-' . Str::random(8);
        $repository->createDirectory(basename($stage), '/' . self::WORK_DIR);
        $repository->renameFiles('/' . self::WORK_DIR, [['from' => $file, 'to' => basename($stage) . '/' . $file]]);

        try {
            set_time_limit(0);
            $repository->decompressFile('/' . $stage, $file);
            $repository->deleteFiles('/' . $stage, [$file]);

            $source = $this->locateWorldInside($server, $stage);
            $target = $this->sanitiseName($name ?: preg_replace('/\.(zip|tar|tar\.gz|tgz)$/i', '', $file));
            $target = $this->uniqueName($server, $target);

            $renames = [['from' => ltrim($source, '/'), 'to' => $target]];
            foreach (['_nether', '_the_end'] as $suffix) {
                $sibling = $source . $suffix;
                if ($this->pathExists($server, dirname('/' . $sibling), basename($sibling))) {
                    $renames[] = ['from' => ltrim($sibling, '/'), 'to' => $target . $suffix];
                }
            }

            $repository->renameFiles('/', $renames);

            return $target;
        } finally {
            try {
                $repository->deleteFiles('/' . self::WORK_DIR, [basename($stage)]);
            } catch (\Throwable) {
                // Leftover scratch data is harmless, never fail the import over it.
            }
        }
    }

    // ------------------------------------------------------------- settings

    /** @return array<string, string> */
    public function settings(Server $server): array
    {
        $all = $this->properties($server)->all();

        $settings = ['level-name' => $all['level-name'] ?? 'world'];
        foreach (self::EDITABLE_SETTINGS as $key) {
            $settings[$key] = $all[$key] ?? '';
        }

        return $settings;
    }

    /** @param array<string, string> $values */
    public function updateSettings(Server $server, array $values): void
    {
        $allowed = array_intersect_key($values, array_flip(self::EDITABLE_SETTINGS));
        if (empty($allowed)) {
            return;
        }

        $this->writeProperties($server, $this->properties($server)->merge(array_map(
            fn ($value) => is_bool($value) ? ($value ? 'true' : 'false') : (string) $value,
            $allowed
        )));
    }

    // -------------------------------------------------------------- helpers

    public function serverState(Server $server): ?string
    {
        try {
            $details = $this->serverRepository->setServer($server)->getDetails();
        } catch (\Throwable) {
            return null;
        }

        return $details['state'] ?? ($details['attributes']['state'] ?? null);
    }

    /**
     * Destructive operations require a stopped server, otherwise Minecraft
     * happily writes the world back out from memory.
     */
    public function assertOffline(Server $server): void
    {
        $state = $this->serverState($server);

        if ($state !== null && $state !== 'offline') {
            throw new DisplayException('The server has to be completely stopped before running this action.');
        }
    }

    private function properties(Server $server): ServerProperties
    {
        try {
            $contents = $this->fileRepository->setServer($server)->getContent(self::PROPERTIES_FILE, 512 * 1024);
        } catch (\Throwable) {
            $contents = '';
        }

        return ServerProperties::parse($contents);
    }

    private function writeProperties(Server $server, ServerProperties $properties): void
    {
        $this->fileRepository->setServer($server)->putContent(self::PROPERTIES_FILE, $properties->toString());
    }

    private function looksLikeWorld(Server $server, string $directory): bool
    {
        return $this->pathExists($server, '/' . $directory, 'level.dat')
            || $this->pathExists($server, '/' . $directory, 'level.dat_old')
            || $this->pathExists($server, '/' . $directory, 'db'); // Bedrock
    }

    private function pathExists(Server $server, string $directory, string $name): bool
    {
        try {
            foreach ($this->fileRepository->setServer($server)->getDirectory($directory) as $entry) {
                if (($entry['name'] ?? null) === $name) {
                    return true;
                }
            }
        } catch (\Throwable) {
            return false;
        }

        return false;
    }

    /**
     * Finds the folder holding level.dat inside an extracted archive; archives
     * are just as often zipped "from inside" as "from outside" the world folder.
     */
    private function locateWorldInside(Server $server, string $stage): string
    {
        if ($this->pathExists($server, '/' . $stage, 'level.dat')) {
            return $stage;
        }

        foreach ($this->fileRepository->setServer($server)->getDirectory('/' . $stage) as $entry) {
            if (!($entry['directory'] ?? false)) {
                continue;
            }

            $candidate = $stage . '/' . $entry['name'];
            if ($this->pathExists($server, '/' . $candidate, 'level.dat')) {
                return $candidate;
            }
        }

        throw new DisplayException('No level.dat was found in the uploaded archive, so it is not a Minecraft world.');
    }

    private function prepareWorkDirectory(Server $server): void
    {
        $repository = $this->fileRepository->setServer($server);

        try {
            $repository->createDirectory(self::WORK_DIR, '/');
        } catch (\Throwable) {
            // Already exists.
        }

        // Drop archives from earlier downloads so the directory does not grow forever.
        try {
            $stale = [];
            foreach ($repository->getDirectory('/' . self::WORK_DIR) as $entry) {
                if (!($entry['directory'] ?? false) && str_ends_with($entry['name'] ?? '', '.tar.gz')) {
                    $stale[] = $entry['name'];
                }
            }
            if (!empty($stale)) {
                $repository->deleteFiles('/' . self::WORK_DIR, $stale);
            }
        } catch (\Throwable) {
            // Nothing to clean up.
        }
    }

    public function sanitiseName(string $name): string
    {
        $name = trim(str_replace(['/', '\\', "\0"], '', $name));
        $name = preg_replace('/\.\.+/', '.', $name) ?? '';
        $name = trim($name, '. ');

        if ($name === '' || strlen($name) > 64) {
            throw new DisplayException('Invalid world name. Use 1-64 characters without slashes.');
        }

        return $name;
    }

    private function assertWorldExists(Server $server, string $name): void
    {
        $name = $this->sanitiseName($name);

        foreach ($this->worlds($server) as $world) {
            if ($world['name'] === $name) {
                return;
            }
        }

        throw new DisplayException(sprintf('The world "%s" does not exist on this server.', $name));
    }

    private function assertNameAvailable(Server $server, string $name): void
    {
        if ($this->pathExists($server, '/', $name)) {
            throw new DisplayException(sprintf('A file or folder named "%s" already exists.', $name));
        }
    }

    private function uniqueName(Server $server, string $name): string
    {
        $candidate = $name;
        $suffix = 1;

        while ($this->pathExists($server, '/', $candidate)) {
            $candidate = $name . '-' . ++$suffix;
        }

        return $candidate;
    }
}
