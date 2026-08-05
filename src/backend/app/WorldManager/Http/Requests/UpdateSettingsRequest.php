<?php

namespace Pterodactyl\WorldManager\Http\Requests;

use Pterodactyl\Models\Permission;
use Pterodactyl\WorldManager\WorldService;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class UpdateSettingsRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_FILE_UPDATE;
    }

    public function rules(): array
    {
        $rules = [];
        foreach (WorldService::EDITABLE_SETTINGS as $key) {
            $rules[$key] = 'sometimes|nullable|string|max:256';
        }

        return $rules;
    }

    /**
     * Booleans and numbers arrive as JSON primitives; server.properties is text.
     */
    protected function prepareForValidation(): void
    {
        $normalised = [];
        foreach ($this->all() as $key => $value) {
            if (is_bool($value)) {
                $value = $value ? 'true' : 'false';
            } elseif (is_int($value) || is_float($value)) {
                $value = (string) $value;
            }
            $normalised[$key] = $value;
        }

        $this->replace($normalised);
    }
}
