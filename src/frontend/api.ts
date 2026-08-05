import axios from 'axios';
import http from '@/api/http';

export interface World {
    name: string;
    active: boolean;
    dimensions: string[];
    modified_at: string | null;
}

export type WorldSettings = Record<string, string>;

export interface WorldManagerState {
    minecraft: boolean;
    state: string | null;
    active: string;
    worlds: World[];
    settings: WorldSettings;
}

const base = (uuid: string) => `/api/client/servers/${uuid}/world-manager`;

export const getWorldManagerState = async (uuid: string): Promise<WorldManagerState> =>
    (await http.get(base(uuid))).data;

export const activateWorld = async (uuid: string, world: string): Promise<void> => {
    await http.post(`${base(uuid)}/activate`, { world });
};

export const renameWorld = async (uuid: string, world: string, name: string): Promise<string> =>
    (await http.post(`${base(uuid)}/rename`, { world, name })).data.world;

export const duplicateWorld = async (uuid: string, world: string, name: string): Promise<string> =>
    (await http.post(`${base(uuid)}/duplicate`, { world, name })).data.world;

export const resetWorld = async (uuid: string, world: string, seed?: string): Promise<void> => {
    await http.post(`${base(uuid)}/reset`, { world, seed: seed || null });
};

export const deleteWorld = async (uuid: string, world: string): Promise<void> => {
    await http.post(`${base(uuid)}/delete`, { world });
};

export const downloadWorld = async (uuid: string, world: string): Promise<string> =>
    (await http.post(`${base(uuid)}/download`, { world })).data.url;

export const updateSettings = async (uuid: string, settings: WorldSettings): Promise<WorldSettings> =>
    (await http.put(`${base(uuid)}/settings`, settings)).data.settings;

/**
 * Uploads the archive straight to Wings using a signed URL, then asks the panel
 * to unpack it. The panel never proxies the file itself, so world size is only
 * limited by the node's disk.
 */
export const importWorld = async (
    uuid: string,
    file: File,
    name: string | null,
    onProgress: (percent: number) => void
): Promise<string> => {
    const { data } = await http.get(`${base(uuid)}/upload-url`);

    const form = new FormData();
    form.append('files', file);

    await axios.post(`${data.url}&directory=${encodeURIComponent(data.directory)}`, form, {
        onUploadProgress: (event) => {
            if (event.total) {
                onProgress(Math.round((event.loaded / event.total) * 100));
            }
        },
    });

    onProgress(100);

    return (await http.post(`${base(uuid)}/import`, { file: file.name, name })).data.world;
};
