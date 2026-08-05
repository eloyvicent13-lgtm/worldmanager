<?php

namespace Pterodactyl\WorldManager;

use Pterodactyl\Models\Server;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;

/**
 * Decides whether a given server is a Minecraft server.
 *
 * The check is intentionally layered: egg features are the cheapest and most
 * reliable signal, name/image matching catches custom eggs, and the daemon
 * lookup is only used as a last resort because it costs a network round trip.
 */
class MinecraftDetector
{
    /**
     * Keywords found in egg names, nest names or docker images of Minecraft eggs.
     */
    private const KEYWORDS = [
        'minecraft', 'paper', 'papermc', 'spigot', 'bukkit', 'purpur', 'pufferfish',
        'forge', 'neoforge', 'fabric', 'quilt', 'sponge', 'magma', 'mohist', 'arclight',
        'folia', 'leaves', 'airplane', 'vanilla', 'bedrock', 'pocketmine', 'nukkit',
        'bungeecord', 'waterfall', 'velocity', 'travertine', 'ftb', 'curseforge',
    ];

    public function __construct(private DaemonFileRepository $fileRepository)
    {
    }

    /**
     * Returns true when the server looks like a Minecraft server.
     */
    public function isMinecraft(Server $server, bool $allowDaemonLookup = true): bool
    {
        $egg = $server->egg;

        if ($egg && in_array('eula', (array) ($egg->features ?? []), true)) {
            return true;
        }

        $haystack = strtolower(implode(' ', array_filter([
            $egg->name ?? '',
            $egg->docker_images ? implode(' ', (array) $egg->docker_images) : '',
            optional($egg->nest ?? null)->name ?? '',
            $server->image ?? '',
        ])));

        foreach (self::KEYWORDS as $keyword) {
            if ($haystack !== '' && str_contains($haystack, $keyword)) {
                return true;
            }
        }

        if (!$allowDaemonLookup) {
            return false;
        }

        try {
            foreach ($this->fileRepository->setServer($server)->getDirectory('/') as $entry) {
                if (($entry['name'] ?? null) === 'server.properties') {
                    return true;
                }
            }
        } catch (\Throwable) {
            // A dead node should never make the whole page explode; treat it as "not Minecraft".
        }

        return false;
    }
}
