<?php

namespace Pterodactyl\WorldManager\Http;

use Illuminate\Http\Response;
use Pterodactyl\Models\Server;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Facades\Activity;
use Pterodactyl\WorldManager\WorldService;
use Pterodactyl\WorldManager\MinecraftDetector;
use Pterodactyl\WorldManager\Http\Requests\ViewWorldsRequest;
use Pterodactyl\WorldManager\Http\Requests\CreateWorldRequest;
use Pterodactyl\WorldManager\Http\Requests\DeleteWorldRequest;
use Pterodactyl\WorldManager\Http\Requests\UpdateWorldRequest;
use Pterodactyl\WorldManager\Http\Requests\DownloadWorldRequest;
use Pterodactyl\WorldManager\Http\Requests\UpdateSettingsRequest;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class WorldManagerController extends ClientApiController
{
    public function __construct(
        private WorldService $worlds,
        private MinecraftDetector $detector,
    ) {
        parent::__construct();
    }

    /**
     * Everything the World Manager page needs in a single request.
     */
    public function index(ViewWorldsRequest $request, Server $server): JsonResponse
    {
        $this->assertMinecraft($server);

        return new JsonResponse([
            'minecraft' => true,
            'state' => $this->worlds->serverState($server),
            'active' => $this->worlds->activeWorldName($server),
            'worlds' => $this->worlds->worlds($server),
            'settings' => $this->worlds->settings($server),
        ]);
    }

    /**
     * Lightweight probe used by the sidebar to decide whether to show the tab.
     */
    public function detect(ViewWorldsRequest $request, Server $server): JsonResponse
    {
        return new JsonResponse(['minecraft' => $this->detector->isMinecraft($server)]);
    }

    public function activate(UpdateWorldRequest $request, Server $server): JsonResponse
    {
        $this->assertMinecraft($server);

        $world = $request->input('world');
        $this->worlds->activate($server, $world);

        Activity::event('server:world-manager.activate')->property('world', $world)->log();

        return new JsonResponse(['world' => $world]);
    }

    public function rename(UpdateWorldRequest $request, Server $server): JsonResponse
    {
        $this->assertMinecraft($server);
        $this->worlds->assertOffline($server);

        $name = $this->worlds->rename($server, $request->input('world'), (string) $request->input('name'));

        Activity::event('server:world-manager.rename')
            ->property('world', $request->input('world'))
            ->property('name', $name)
            ->log();

        return new JsonResponse(['world' => $name]);
    }

    public function duplicate(CreateWorldRequest $request, Server $server): JsonResponse
    {
        $this->assertMinecraft($server);

        $request->validate([
            'world' => 'required|string|max:64',
            'name' => 'required|string|max:64',
        ]);

        $name = $this->worlds->duplicate($server, $request->input('world'), (string) $request->input('name'));

        Activity::event('server:world-manager.duplicate')->property('world', $name)->log();

        return new JsonResponse(['world' => $name]);
    }

    public function reset(DeleteWorldRequest $request, Server $server): JsonResponse
    {
        $this->assertMinecraft($server);
        $this->worlds->assertOffline($server);

        $world = $request->input('world');
        $this->worlds->reset($server, $world, $request->input('seed'));

        Activity::event('server:world-manager.reset')->property('world', $world)->log();

        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }

    public function delete(DeleteWorldRequest $request, Server $server): JsonResponse
    {
        $this->assertMinecraft($server);
        $this->worlds->assertOffline($server);

        $world = $request->input('world');
        $this->worlds->delete($server, $world);

        Activity::event('server:world-manager.delete')->property('world', $world)->log();

        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }

    public function download(DownloadWorldRequest $request, Server $server): JsonResponse
    {
        $this->assertMinecraft($server);

        $world = $request->input('world');
        $url = $this->worlds->downloadUrl($server, $request->user(), $world);

        Activity::event('server:world-manager.download')->property('world', $world)->log();

        return new JsonResponse(['url' => $url]);
    }

    public function uploadUrl(CreateWorldRequest $request, Server $server): JsonResponse
    {
        $this->assertMinecraft($server);

        return new JsonResponse([
            'url' => $this->worlds->uploadUrl($server, $request->user()),
            'directory' => '/' . WorldService::WORK_DIR,
        ]);
    }

    public function import(CreateWorldRequest $request, Server $server): JsonResponse
    {
        $this->assertMinecraft($server);
        $this->worlds->assertOffline($server);

        $request->validate([
            'file' => 'required|string|max:255',
            'name' => 'sometimes|nullable|string|max:64',
        ]);

        $name = $this->worlds->import($server, $request->input('file'), $request->input('name'));

        Activity::event('server:world-manager.import')->property('world', $name)->log();

        return new JsonResponse(['world' => $name]);
    }

    public function settings(ViewWorldsRequest $request, Server $server): JsonResponse
    {
        $this->assertMinecraft($server);

        return new JsonResponse(['settings' => $this->worlds->settings($server)]);
    }

    public function updateSettings(UpdateSettingsRequest $request, Server $server): JsonResponse
    {
        $this->assertMinecraft($server);

        $this->worlds->updateSettings($server, $request->validated());

        Activity::event('server:world-manager.settings')
            ->property('keys', array_keys($request->validated()))
            ->log();

        return new JsonResponse(['settings' => $this->worlds->settings($server)]);
    }

    /**
     * Non-Minecraft servers must not be able to reach any of these endpoints,
     * even if somebody hits the API directly.
     */
    private function assertMinecraft(Server $server): void
    {
        if (!$this->detector->isMinecraft($server)) {
            throw new NotFoundHttpException('This server is not a Minecraft server.');
        }
    }
}
