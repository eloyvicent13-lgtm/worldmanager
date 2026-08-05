import React, { useCallback, useEffect, useState } from 'react';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Spinner from '@/components/elements/Spinner';
import { ServerContext } from '@/state/server';
import Modal from '@/worldmanager/Modal';
import SettingsTab from '@/worldmanager/SettingsTab';
import {
    activateWorld,
    deleteWorld,
    downloadWorld,
    duplicateWorld,
    getWorldManagerState,
    importWorld,
    renameWorld,
    resetWorld,
    updateSettings,
    World,
    WorldManagerState,
    WorldSettings,
} from '@/worldmanager/api';

type Tab = 'worlds' | 'settings';
type Action = 'rename' | 'duplicate' | 'reset' | 'delete' | 'import';

const errorMessage = (error: any): string =>
    error?.response?.data?.errors?.[0]?.detail || error?.response?.data?.error || error?.message || 'Unknown error.';

export default function WorldManagerContainer() {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);

    const [data, setData] = useState<WorldManagerState | null>(null);
    const [tab, setTab] = useState<Tab>('worlds');
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [saving, setSaving] = useState(false);

    const [action, setAction] = useState<{ type: Action; world?: World } | null>(null);
    const [input, setInput] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [progress, setProgress] = useState<number | null>(null);

    const refresh = useCallback(async () => {
        try {
            setData(await getWorldManagerState(uuid));
        } catch (caught) {
            setError(errorMessage(caught));
        }
    }, [uuid]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const run = async (task: () => Promise<string | void>, success: string) => {
        setBusy(true);
        setError(null);
        setNotice(null);

        try {
            await task();
            setNotice(success);
            setAction(null);
            setFile(null);
            setProgress(null);
            await refresh();
        } catch (caught) {
            setError(errorMessage(caught));
        } finally {
            setBusy(false);
        }
    };

    const openAction = (type: Action, world?: World) => {
        // Delete asks the user to retype the name, so it must start empty.
        setInput(type === 'duplicate' && world ? `${world.name}-copy` : type === 'rename' ? world?.name ?? '' : '');
        setAction({ type, world });
    };

    const download = (world: World) =>
        run(async () => {
            const url = await downloadWorld(uuid, world.name);
            window.location.href = url;
        }, `Packaging "${world.name}" — the download starts in a moment.`);

    const save = async (values: WorldSettings) => {
        setSaving(true);
        setError(null);
        setNotice(null);

        try {
            const settings = await updateSettings(uuid, values);
            setData((current) => (current ? { ...current, settings } : current));
            setNotice('Settings saved. Restart the server to apply them.');
        } catch (caught) {
            setError(errorMessage(caught));
        } finally {
            setSaving(false);
        }
    };

    if (!data && !error) {
        return (
            <ServerContentBlock title={'World Manager'}>
                <Spinner size={'large'} centered />
            </ServerContentBlock>
        );
    }

    const offline = !data?.state || data.state === 'offline';

    return (
        <ServerContentBlock title={'World Manager'}>
            <div className={'mb-6'}>
                <h1 className={'text-2xl font-semibold text-neutral-100'}>World Manager</h1>
                <p className={'mt-1 text-sm text-neutral-400'}>
                    Download, upload and switch worlds, or change how the world plays.
                </p>
            </div>

            {error && (
                <div className={'mb-4 rounded border border-red-700 bg-red-900 bg-opacity-40 px-4 py-3 text-sm text-red-200'}>
                    {error}
                </div>
            )}
            {notice && (
                <div className={'mb-4 rounded border border-green-700 bg-green-900 bg-opacity-30 px-4 py-3 text-sm text-green-200'}>
                    {notice}
                </div>
            )}
            {!offline && (
                <div className={'mb-4 rounded border border-yellow-700 bg-yellow-900 bg-opacity-30 px-4 py-3 text-sm text-yellow-200'}>
                    The server is running. Stop it before importing, resetting, renaming or deleting a world —
                    Minecraft keeps the loaded world in memory and would overwrite your changes.
                </div>
            )}

            <div className={'mb-6 flex gap-2 border-b border-neutral-700'}>
                {(['worlds', 'settings'] as Tab[]).map((value) => (
                    <button
                        key={value}
                        type={'button'}
                        onClick={() => setTab(value)}
                        className={`-mb-px border-b-2 px-4 py-2 text-sm capitalize ${
                            tab === value
                                ? 'border-cyan-500 text-neutral-100'
                                : 'border-transparent text-neutral-400 hover:text-neutral-200'
                        }`}
                    >
                        {value === 'worlds' ? 'Worlds' : 'World settings'}
                    </button>
                ))}
            </div>

            {tab === 'settings' && data && (
                <SettingsTab key={JSON.stringify(data.settings)} settings={data.settings} saving={saving} onSave={save} />
            )}

            {tab === 'worlds' && data && (
                <>
                    <div className={'mb-6 rounded-lg border border-dashed border-neutral-600 bg-neutral-800 p-6'}>
                        <h3 className={'text-sm font-semibold uppercase tracking-wide text-neutral-300'}>
                            Upload a world
                        </h3>
                        <p className={'mt-1 text-sm text-neutral-400'}>
                            A <code>.zip</code> or <code>.tar.gz</code> archive containing a folder with{' '}
                            <code>level.dat</code>. The file is uploaded straight to the node.
                        </p>
                        <div className={'mt-4 flex flex-wrap items-center gap-3'}>
                            <input
                                type={'file'}
                                accept={'.zip,.tar,.tar.gz,.tgz'}
                                onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
                                className={'text-sm text-neutral-300'}
                            />
                            <button
                                type={'button'}
                                disabled={!file || busy}
                                onClick={() => openAction('import')}
                                className={
                                    'rounded bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50'
                                }
                            >
                                Upload world
                            </button>
                        </div>
                        {progress !== null && (
                            <div className={'mt-4 h-2 w-full overflow-hidden rounded bg-neutral-900'}>
                                <div className={'h-full bg-cyan-500 transition-all'} style={{ width: `${progress}%` }} />
                            </div>
                        )}
                    </div>

                    {data.worlds.length === 0 ? (
                        <p className={'rounded-lg bg-neutral-800 p-6 text-sm text-neutral-400'}>
                            No worlds found yet. Start the server once to generate one, or upload an archive above.
                        </p>
                    ) : (
                        <div className={'space-y-3'}>
                            {data.worlds.map((world) => (
                                <div
                                    key={world.name}
                                    className={'flex flex-wrap items-center gap-4 rounded-lg bg-neutral-800 p-4'}
                                >
                                    <div className={'min-w-0 flex-1'}>
                                        <div className={'flex items-center gap-2'}>
                                            <span className={'truncate font-medium text-neutral-100'}>{world.name}</span>
                                            {world.active && (
                                                <span
                                                    className={
                                                        'rounded bg-cyan-600 px-2 py-0.5 text-xs font-semibold uppercase text-white'
                                                    }
                                                >
                                                    Active
                                                </span>
                                            )}
                                        </div>
                                        <p className={'mt-1 text-xs text-neutral-400'}>
                                            Dimensions: {world.dimensions.join(', ')}
                                        </p>
                                    </div>
                                    <div className={'flex flex-wrap gap-2'}>
                                        {!world.active && (
                                            <button
                                                type={'button'}
                                                disabled={busy}
                                                onClick={() =>
                                                    run(
                                                        () => activateWorld(uuid, world.name),
                                                        `"${world.name}" is now the active world. Restart the server to load it.`
                                                    )
                                                }
                                                className={'rounded bg-neutral-700 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-600'}
                                            >
                                                Activate
                                            </button>
                                        )}
                                        <button
                                            type={'button'}
                                            disabled={busy}
                                            onClick={() => download(world)}
                                            className={'rounded bg-neutral-700 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-600'}
                                        >
                                            Download
                                        </button>
                                        <button
                                            type={'button'}
                                            disabled={busy}
                                            onClick={() => openAction('duplicate', world)}
                                            className={'rounded bg-neutral-700 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-600'}
                                        >
                                            Duplicate
                                        </button>
                                        <button
                                            type={'button'}
                                            disabled={busy}
                                            onClick={() => openAction('rename', world)}
                                            className={'rounded bg-neutral-700 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-600'}
                                        >
                                            Rename
                                        </button>
                                        <button
                                            type={'button'}
                                            disabled={busy}
                                            onClick={() => openAction('reset', world)}
                                            className={'rounded bg-yellow-700 px-3 py-1.5 text-xs text-white hover:bg-yellow-600'}
                                        >
                                            Reset
                                        </button>
                                        <button
                                            type={'button'}
                                            disabled={busy || world.active}
                                            title={world.active ? 'Activate another world first.' : undefined}
                                            onClick={() => openAction('delete', world)}
                                            className={'rounded bg-red-700 px-3 py-1.5 text-xs text-white hover:bg-red-600 disabled:opacity-40'}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {action?.type === 'rename' && action.world && (
                <Modal
                    title={`Rename "${action.world.name}"`}
                    description={'The Nether and End folders are renamed along with the overworld.'}
                    confirmLabel={'Rename'}
                    busy={busy}
                    disabled={!input.trim()}
                    onClose={() => setAction(null)}
                    onConfirm={() =>
                        run(() => renameWorld(uuid, action.world!.name, input.trim()), 'World renamed.')
                    }
                >
                    <input
                        autoFocus
                        value={input}
                        onChange={(event) => setInput(event.currentTarget.value)}
                        className={'w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100'}
                    />
                </Modal>
            )}

            {action?.type === 'duplicate' && action.world && (
                <Modal
                    title={`Duplicate "${action.world.name}"`}
                    description={'A full copy is made on the node. Large worlds take a while.'}
                    confirmLabel={'Duplicate'}
                    busy={busy}
                    disabled={!input.trim()}
                    onClose={() => setAction(null)}
                    onConfirm={() =>
                        run(() => duplicateWorld(uuid, action.world!.name, input.trim()), 'World duplicated.')
                    }
                >
                    <input
                        autoFocus
                        value={input}
                        onChange={(event) => setInput(event.currentTarget.value)}
                        className={'w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100'}
                    />
                </Modal>
            )}

            {action?.type === 'reset' && action.world && (
                <Modal
                    title={`Reset "${action.world.name}"`}
                    description={
                        'Every chunk, player inventory and structure in this world is deleted. The server generates a brand new world on the next start. This cannot be undone — download a copy first if you want to keep it.'
                    }
                    confirmLabel={'Reset world'}
                    confirmDanger
                    busy={busy}
                    onClose={() => setAction(null)}
                    onConfirm={() =>
                        run(
                            () => resetWorld(uuid, action.world!.name, input.trim() || undefined),
                            'World reset. It regenerates on the next start.'
                        )
                    }
                >
                    <label className={'mb-1 block text-xs uppercase tracking-wide text-neutral-400'}>
                        New seed (optional)
                    </label>
                    <input
                        value={input}
                        onChange={(event) => setInput(event.currentTarget.value)}
                        placeholder={'Leave empty for a random seed'}
                        className={'w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100'}
                    />
                </Modal>
            )}

            {action?.type === 'delete' && action.world && (
                <Modal
                    title={`Delete "${action.world.name}"`}
                    description={'The world folder and its Nether and End dimensions are removed permanently.'}
                    confirmLabel={'Delete world'}
                    confirmDanger
                    busy={busy}
                    disabled={input.trim() !== action.world.name}
                    onClose={() => setAction(null)}
                    onConfirm={() => run(() => deleteWorld(uuid, action.world!.name), 'World deleted.')}
                >
                    <div className={'text-sm text-neutral-300'}>
                        Type <span className={'font-medium text-neutral-100'}>{action.world.name}</span> to confirm:
                        <input
                            autoFocus
                            value={input}
                            onChange={(event) => setInput(event.currentTarget.value)}
                            className={'mt-2 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100'}
                        />
                    </div>
                </Modal>
            )}

            {action?.type === 'import' && file && (
                <Modal
                    title={'Upload world'}
                    description={`"${file.name}" is uploaded to the node and unpacked as a new world. Existing worlds are never overwritten.`}
                    confirmLabel={'Upload'}
                    busy={busy}
                    onClose={() => setAction(null)}
                    onConfirm={() =>
                        run(
                            () => importWorld(uuid, file, input.trim() || null, setProgress),
                            'World uploaded. Activate it to make the server use it.'
                        )
                    }
                >
                    <label className={'mb-1 block text-xs uppercase tracking-wide text-neutral-400'}>
                        World name (optional)
                    </label>
                    <input
                        value={input}
                        onChange={(event) => setInput(event.currentTarget.value)}
                        placeholder={'Defaults to the archive name'}
                        className={'w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100'}
                    />
                </Modal>
            )}
        </ServerContentBlock>
    );
}
