export interface SettingField {
    key: string;
    label: string;
    help?: string;
    type: 'bool' | 'number' | 'text' | 'select';
    options?: string[];
}

export interface SettingSection {
    title: string;
    fields: SettingField[];
}

/**
 * Mirrors WorldService::EDITABLE_SETTINGS on the backend. Anything not listed
 * here is never written back to server.properties.
 */
export const SETTING_SECTIONS: SettingSection[] = [
    {
        title: 'World',
        fields: [
            {
                key: 'level-seed',
                label: 'Seed',
                type: 'text',
                help: 'Only used when the world is generated for the first time.',
            },
            {
                key: 'level-type',
                label: 'World type',
                type: 'text',
                help: 'e.g. minecraft:normal, minecraft:flat, minecraft:large_biomes, minecraft:amplified.',
            },
            { key: 'generate-structures', label: 'Generate structures', type: 'bool' },
            { key: 'allow-nether', label: 'Allow the Nether', type: 'bool' },
            { key: 'max-world-size', label: 'Max world size (blocks)', type: 'number' },
        ],
    },
    {
        title: 'Gameplay',
        fields: [
            {
                key: 'gamemode',
                label: 'Game mode',
                type: 'select',
                options: ['survival', 'creative', 'adventure', 'spectator'],
            },
            { key: 'force-gamemode', label: 'Force game mode', type: 'bool' },
            {
                key: 'difficulty',
                label: 'Difficulty',
                type: 'select',
                options: ['peaceful', 'easy', 'normal', 'hard'],
            },
            { key: 'hardcore', label: 'Hardcore', type: 'bool', help: 'Death is permanent, players get banned.' },
            { key: 'pvp', label: 'PvP', type: 'bool' },
            { key: 'allow-flight', label: 'Allow flight', type: 'bool' },
            { key: 'enable-command-block', label: 'Command blocks', type: 'bool' },
        ],
    },
    {
        title: 'Spawning',
        fields: [
            { key: 'spawn-animals', label: 'Spawn animals', type: 'bool' },
            { key: 'spawn-monsters', label: 'Spawn monsters', type: 'bool' },
            { key: 'spawn-npcs', label: 'Spawn villagers', type: 'bool' },
            { key: 'spawn-protection', label: 'Spawn protection (blocks)', type: 'number' },
        ],
    },
    {
        title: 'Players',
        fields: [
            { key: 'max-players', label: 'Max players', type: 'number' },
            { key: 'motd', label: 'MOTD', type: 'text' },
            { key: 'white-list', label: 'Whitelist', type: 'bool' },
            { key: 'online-mode', label: 'Online mode', type: 'bool', help: 'Turn off only behind a proxy.' },
            { key: 'player-idle-timeout', label: 'Idle timeout (minutes)', type: 'number' },
        ],
    },
    {
        title: 'Performance',
        fields: [
            { key: 'view-distance', label: 'View distance (chunks)', type: 'number' },
            { key: 'simulation-distance', label: 'Simulation distance (chunks)', type: 'number' },
        ],
    },
];
