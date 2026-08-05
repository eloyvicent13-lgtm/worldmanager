<?php

namespace Pterodactyl\WorldManager;

/**
 * Parser/serialiser for Minecraft's server.properties.
 *
 * The file follows the java.util.Properties format, so values are escaped:
 * Minecraft writes `level-type=minecraft\:normal`. Values are unescaped on the
 * way in and escaped again on the way out.
 *
 * Comments, blank lines and key order are preserved, and untouched keys keep
 * their original line verbatim, so editing one setting can never reformat the
 * rest of the file.
 */
class ServerProperties
{
    /** @var array<int, array{type: string, raw: string, key?: string, value?: string, dirty?: bool}> */
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

            $position = self::separatorPosition($line);
            if ($position === null) {
                $instance->lines[] = ['type' => 'raw', 'raw' => $line];

                continue;
            }

            $instance->lines[] = [
                'type' => 'pair',
                'raw' => $line,
                'key' => self::unescape(trim(substr($line, 0, $position))),
                'value' => self::unescape(trim(substr($line, $position + 1))),
                'dirty' => false,
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
                if ($line['value'] !== $value) {
                    $this->lines[$index]['value'] = $value;
                    $this->lines[$index]['dirty'] = true;
                }

                return $this;
            }
        }

        $this->lines[] = ['type' => 'pair', 'raw' => '', 'key' => $key, 'value' => $value, 'dirty' => true];

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
            if ($line['type'] !== 'pair') {
                $out[] = $line['raw'];

                continue;
            }

            $out[] = $line['dirty']
                ? self::escape($line['key'], true) . '=' . self::escape($line['value'])
                : $line['raw'];
        }

        return implode("\n", $out);
    }

    /**
     * Finds the first unescaped `=` or `:` separating the key from the value.
     */
    private static function separatorPosition(string $line): ?int
    {
        $length = strlen($line);
        for ($i = 0; $i < $length; ++$i) {
            if ($line[$i] === '\\') {
                ++$i;

                continue;
            }
            if ($line[$i] === '=' || $line[$i] === ':') {
                return $i;
            }
        }

        return null;
    }

    private static function unescape(string $value): string
    {
        return preg_replace_callback('/\\\\(u[0-9a-fA-F]{4}|.)/s', function (array $matches): string {
            $escaped = $matches[1];

            if ($escaped[0] === 'u' && strlen($escaped) === 5) {
                $codepoint = hexdec(substr($escaped, 1));

                return function_exists('mb_chr') ? (mb_chr($codepoint, 'UTF-8') ?: '') : '';
            }

            return match ($escaped) {
                'n' => "\n",
                'r' => "\r",
                't' => "\t",
                'f' => "\f",
                default => $escaped,
            };
        }, $value) ?? $value;
    }

    /**
     * Mirrors java.util.Properties#store, which escapes `=`, `:`, `#` and `!`
     * in both keys and values, and additionally escapes spaces inside keys.
     */
    private static function escape(string $value, bool $isKey = false): string
    {
        $escaped = strtr($value, [
            '\\' => '\\\\',
            "\n" => '\\n',
            "\r" => '\\r',
            "\t" => '\\t',
            "\f" => '\\f',
            '=' => '\\=',
            ':' => '\\:',
            '#' => '\\#',
            '!' => '\\!',
        ]);

        if ($isKey) {
            return str_replace(' ', '\\ ', $escaped);
        }

        // A leading space would be swallowed by the reader.
        return str_starts_with($escaped, ' ') ? '\\' . $escaped : $escaped;
    }
}
