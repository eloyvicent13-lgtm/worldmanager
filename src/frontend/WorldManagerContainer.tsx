import React, { useCallback, useEffect, useState } from 'react';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Spinner from '@/components/elements/Spinner';
import { ServerContext } from '@/state/server';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCheckCircle,
    faCopy,
    faCube,
    faDownload,
    faExclamationTriangle,
    faGlobe,
    faPencilAlt,
    faSyncAlt,
    faTrashAlt,
    faUpload,
} from '@fortawesome/free-solid-svg-icons';
import Modal from '@/worldmanager/Modal';
import SettingsTab from '@/worldmanager/SettingsTab';
import { Alert, Badge, Button, Card, inputClasses } from '@/worldmanager/ui';
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

const DIMENSION_LABELS: Record<string, string> = {
    overworld: 'Overworld',
    nether: 'Nether',
    the_end: 'The End',
};

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
    const [dragging, setDragging] = useState(false);

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
            <div className={'mb-6 flex flex-wrap items-center justify-between gap-4'}>
                <div className={'flex items-center gap-4'}>
                    <span className={'flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-600 text-white'}>
                        <FontAwesomeIcon icon={faGlobe} size={'lg'} />
                    </span>
                    <div>
                        <h1 className={'text-2xl font-semibold text-neutral-100'}>World Manager</h1>
                        <p className={'text-sm text-neutral-400'}>
                            Download, upload and switch worlds, or change how the world plays.
                        </p>
                    </div>
                </div>
                <Badge tone={offline ? 'neutral' : 'green'}>{offline ? 'Server offline' : data?.state}</Badge>
            </div>

            {error && (
                <Alert tone={'error'} icon={faExclamationTriangle}>
                    {error}
                </Alert>
            )}
            {notice && (
                <Alert tone={'success'} icon={faCheckCircle}>
                    {notice}
                </Alert>
            )}
            {!offline && (
                <Alert tone={'warning'} icon={faExclamationTriangle}>
                    The server is running. Stop it before importing, resetting, renaming or deleting a world — Minecraft
                    keeps the loaded world in memory and would overwrite your changes.
                </Alert>
            )}

            <div className={'mb-6 flex gap-6 border-b border-neutral-700'}>
                {([
                    ['worlds', 'Worlds'],
                    ['settings', 'World settings'],
                ] as [Tab, string][]).map(([value, label]) => (
                    <button
                        key={value}
                        type={'button'}
                        onClick={() => setTab(value)}
                        className={`-mb-px border-b-2 pb-3 text-sm font-medium transition-colors ${
                            tab === value
                                ? 'border-cyan-500 text-neutral-100'
                                : 'border-transparent text-neutral-400 hover:text-neutral-200'
                        }`}
                    >
                        {label}
                        {value === 'worlds' && data && (
                            <span className={'ml-2 rounded bg-neutral-700 px-1.5 py-0.5 text-xs text-neutral-300'}>
                                {data.worlds.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {tab === 'settings' && data && (
                <SettingsTab key={JSON.stringify(data.settings)} settings={data.settings} saving={saving} onSave={save} />
            )}

            {tab === 'worlds' && data && (
                <>
                    <label
                        onDragOver={(event) => {
                            event.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(event) => {
                            event.preventDefault();
                            setDragging(false);
                            setFile(event.dataTransfer.files?.[0] ?? null);
                        }}
                        className={`mb-6 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
                            dragging ? 'border-cyan-500 bg-cyan-900 bg-opacity-20' : 'border-neutral-600 bg-neutral-800 bg-opacity-60'
                        }`}
                    >
                        <input
                            type={'file'}
                            accept={'.zip,.tar,.tar.gz,.tgz'}
                            className={'hidden'}
                            onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
                        />
                        <FontAwesomeIcon icon={faUpload} className={'mb-3 text-2xl text-neutral-500'} />
                        <p className={'text-sm font-medium text-neutral-200'}>
                            {file ? file.name : 'Drop a world archive here, or click to pick one'}
                        </p>
                        <p className={'mt-1 text-xs text-neutral-500'}>
                            <code>.zip</code> or <code>.tar.gz</code> containing a folder with <code>level.dat</code>.
                            Uploaded straight to the node.
                        </p>
                        {file && (
                            <div className={'mt-4 flex gap-3'} onClick={(event) => event.preventDefault()}>
                                <Button variant={'primary'} icon={faUpload} disabled={busy} onClick={() => openAction('import')}>
                                    Upload world
                                </Button>
                                <Button variant={'ghost'} disabled={busy} onClick={() => setFile(null)}>
                                    Clear
                                </Button>
                            </div>
                        )}
                        {progress !== null && (
                            <div className={'mt-4 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-neutral-900'}>
                                <div
                                    className={'h-full rounded-full bg-cyan-500 transition-all duration-200'}
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        )}
                    </label>

                    {data.worlds.length === 0 ? (
                        <Card className={'p-10 text-center'}>
                            <FontAwesomeIcon icon={faCube} className={'mb-3 text-3xl text-neutral-600'} />
                            <p className={'text-sm text-neutral-400'}>
                                No worlds found yet. Start the server once to generate one, or upload an archive above.
                            </p>
                        </Card>
                    ) : (
                        <div className={'space-y-3'}>
                            {data.worlds.map((world) => (
                                <Card key={world.name} className={'p-4'}>
                                    <div className={'flex flex-wrap items-center gap-4'}>
                                        <span
                                            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg ${
                                                world.active ? 'bg-cyan-600 text-white' : 'bg-neutral-700 text-neutral-400'
                                            }`}
                                        >
                                            <FontAwesomeIcon icon={faCube} />
                                        </span>
                                        <div className={'min-w-0 flex-1'}>
                                            <div className={'flex flex-wrap items-center gap-2'}>
                                                <span className={'truncate font-medium text-neutral-100'}>
                                                    {world.name}
                                                </span>
                                                {world.active && <Badge tone={'cyan'}>Active</Badge>}
                                            </div>
                                            <div className={'mt-1.5 flex flex-wrap gap-1.5'}>
                                                {world.dimensions.map((dimension) => (
                                                    <Badge key={dimension}>
                                                        {DIMENSION_LABELS[dimension] ?? dimension}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                        <div className={'flex flex-wrap gap-2'}>
                                            {!world.active && (
                                                <Button
                                                    size={'sm'}
                                                    icon={faCheckCircle}
                                                    disabled={busy}
                                                    onClick={() =>
                                                        run(
                                                            () => activateWorld(uuid, world.name),
                                                            `"${world.name}" is now the active world. Restart the server to load it.`
                                                        )
                                                    }
                                                >
                                                    Activate
                                                </Button>
                                            )}
                                            <Button size={'sm'} icon={faDownload} disabled={busy} onClick={() => download(world)}>
                                                Download
                                            </Button>
                                            <Button
                                                size={'sm'}
                                                icon={faCopy}
                                                disabled={busy}
                                                onClick={() => openAction('duplicate', world)}
                                            >
                                                Duplicate
                                            </Button>
                                            <Button
                                                size={'sm'}
                                                icon={faPencilAlt}
                                                disabled={busy}
                                                onClick={() => openAction('rename', world)}
                                            >
                                                Rename
                                            </Button>
                                            <Button
                                                size={'sm'}
                                                variant={'warning'}
                                                icon={faSyncAlt}
                                                disabled={busy}
                                                onClick={() => openAction('reset', world)}
                                            >
                                                Reset
                                            </Button>
                                            <Button
                                                size={'sm'}
                                                variant={'danger'}
                                                icon={faTrashAlt}
                                                disabled={busy || world.active}
                                                title={world.active ? 'Activate another world first.' : undefined}
                                                onClick={() => openAction('delete', world)}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </>
            )}

            {action?.type === 'rename' && action.world && (
                <Modal
                    title={`Rename "${action.world.name}"`}
                    icon={faPencilAlt}
                    description={'The Nether and End folders are renamed along with the overworld.'}
                    confirmLabel={'Rename'}
                    busy={busy}
                    disabled={!input.trim()}
                    onClose={() => setAction(null)}
                    onConfirm={() => run(() => renameWorld(uuid, action.world!.name, input.trim()), 'World renamed.')}
                >
                    <input
                        autoFocus
                        value={input}
                        onChange={(event) => setInput(event.currentTarget.value)}
                        className={inputClasses}
                    />
                </Modal>
            )}

            {action?.type === 'duplicate' && action.world && (
                <Modal
                    title={`Duplicate "${action.world.name}"`}
                    icon={faCopy}
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
                        className={inputClasses}
                    />
                </Modal>
            )}

            {action?.type === 'reset' && action.world && (
                <Modal
                    title={`Reset "${action.world.name}"`}
                    icon={faSyncAlt}
                    confirmDanger
                    description={
                        'Every chunk, player inventory and structure in this world is deleted. The server generates a brand new world on the next start. This cannot be undone — download a copy first if you want to keep it.'
                    }
                    confirmLabel={'Reset world'}
                    busy={busy}
                    onClose={() => setAction(null)}
                    onConfirm={() =>
                        run(
                            () => resetWorld(uuid, action.world!.name, input.trim() || undefined),
                            'World reset. It regenerates on the next start.'
                        )
                    }
                >
                    <label className={'mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-400'}>
                        New seed (optional)
                    </label>
                    <input
                        value={input}
                        onChange={(event) => setInput(event.currentTarget.value)}
                        placeholder={'Leave empty for a random seed'}
                        className={inputClasses}
                    />
                </Modal>
            )}

            {action?.type === 'delete' && action.world && (
                <Modal
                    title={`Delete "${action.world.name}"`}
                    icon={faTrashAlt}
                    confirmDanger
                    description={'The world folder and its Nether and End dimensions are removed permanently.'}
                    confirmLabel={'Delete world'}
                    busy={busy}
                    disabled={input.trim() !== action.world.name}
                    onClose={() => setAction(null)}
                    onConfirm={() => run(() => deleteWorld(uuid, action.world!.name), 'World deleted.')}
                >
                    <label className={'mb-1.5 block text-sm text-neutral-300'}>
                        Type <span className={'font-medium text-neutral-100'}>{action.world.name}</span> to confirm
                    </label>
                    <input
                        autoFocus
                        value={input}
                        onChange={(event) => setInput(event.currentTarget.value)}
                        className={inputClasses}
                    />
                </Modal>
            )}

            {action?.type === 'import' && file && (
                <Modal
                    title={'Upload world'}
                    icon={faUpload}
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
                    <label className={'mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-400'}>
                        World name (optional)
                    </label>
                    <input
                        value={input}
                        onChange={(event) => setInput(event.currentTarget.value)}
                        placeholder={'Defaults to the archive name'}
                        className={inputClasses}
                    />
                </Modal>
            )}
        </ServerContentBlock>
    );
}
