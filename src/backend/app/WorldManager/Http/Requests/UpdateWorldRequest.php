<?php

namespace Pterodactyl\WorldManager\Http\Requests;

use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class UpdateWorldRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_FILE_UPDATE;
    }

    public function rules(): array
    {
        return [
            'world' => 'required|string|max:64',
            'name' => 'sometimes|string|max:64',
            'seed' => 'sometimes|nullable|string|max:128',
        ];
    }
}
