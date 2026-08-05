<?php

namespace Pterodactyl\WorldManager;

/**
 * Minimal parser/serialiser for Minecraft's server.properties.
 *
 * Comments, blank lines and key order of the original file are preserved so
 * editing a handful of settings never rewrites the user's whole file.
 */
class ServerProperties
{
    /** @var array<int, array{type: string, key?: string, value?: string, raw?: string}> */
    private array $lines = [];

    public static function parse(string $contents): self
    {
        $instance = new self();

        foreach (preg_split("/\r\n|\n|\r/", $contents) as $line) {
            $trimmed = ltrim($line);

            if ($trimmed === '' || str_starts_with($trimmed, '#') || str_starts_with($trimmed, '!')) {
                $instance->lines[] = ['type' => 'raw', 'raw' => $line];

                continue;
            }

            $position = strpos($line, '=');
            if ($position === false) {
                $instance->lines[] = ['type' => 'raw', 'raw' => $line];

                continue;
            }

            $instance->lines[] = [
                'type' => 'pair',
                'key' => trim(substr($line, 0, $position)),
                'value' => trim(substr($line, $position + 1)),
            ];
        }

        return $instance;
    }

    /** @return array<string, string> */
    public function all(): array
    {
        $values = [];
        foreach ($this->lines as $line) {
            if ($line['type'] === 'pair') {
                $values[$line['key']] = $line['value'];
            }
        }

        return $values;
    }

    public function get(string $key, ?string $default = null): ?string
    {
        return $this->all()[$key] ?? $default;
    }

    public function set(string $key, string $value): self
    {
        foreach ($this->lines as $index => $line) {
            if ($line['type'] === 'pair' && $line['key'] === $key) {
                $this->lines[$index]['value'] = $value;

                return $this;
            }
        }

        $this->lines[] = ['type' => 'pair', 'key' => $key, 'value' => $value];

        return $this;
    }

    /** @param array<string, string> $values */
    public function merge(array $values): self
    {
        foreach ($values as $key => $value) {
            $this->set($key, $value);
        }

        return $this;
    }

    public function toString(): string
    {
        $out = [];
        foreach ($this->lines as $line) {
            $out[] = $line['type'] === 'pair'
                ? $line['key'] . '=' . $line['value']
                : $line['raw'];
        }

        return implode("\n", $out);
    }
}
