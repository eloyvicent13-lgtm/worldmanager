<?php

namespace Pterodactyl\WorldManager\Http\Requests;

use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class DownloadWorldRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_FILE_ARCHIVE;
    }

    public function rules(): array
    {
        return [
            'world' => 'required|string|max:64',
        ];
    }
}
