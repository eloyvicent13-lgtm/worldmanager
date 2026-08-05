import React from 'react';

interface Props {
    title: string;
    description?: string;
    confirmLabel?: string;
    confirmDanger?: boolean;
    disabled?: boolean;
    busy?: boolean;
    onConfirm: () => void;
    onClose: () => void;
    children?: React.ReactNode;
}

/**
 * Self contained dialog. Deliberately does not use the panel's dialog
 * components so the addon keeps working on themes that replaced them.
 */
export default function Modal({
    title,
    description,
    confirmLabel = 'Confirm',
    confirmDanger,
    disabled,
    busy,
    onConfirm,
    onClose,
    children,
}: Props) {
    return (
        <div
            className={'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4'}
            onClick={(event) => event.target === event.currentTarget && onClose()}
        >
            <div className={'w-full max-w-md rounded-lg bg-neutral-800 shadow-xl'}>
                <div className={'px-6 pt-6'}>
                    <h3 className={'text-xl font-semibold text-neutral-100'}>{title}</h3>
                    {description && <p className={'mt-2 text-sm text-neutral-400'}>{description}</p>}
                </div>
                {children && <div className={'px-6 pt-4'}>{children}</div>}
                <div className={'mt-6 flex justify-end gap-3 rounded-b-lg bg-neutral-900 px-6 py-4'}>
                    <button
                        type={'button'}
                        onClick={onClose}
                        className={'rounded px-4 py-2 text-sm text-neutral-300 hover:text-neutral-100'}
                    >
                        Cancel
                    </button>
                    <button
                        type={'button'}
                        disabled={disabled || busy}
                        onClick={onConfirm}
                        className={`rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                            confirmDanger ? 'bg-red-600 hover:bg-red-500' : 'bg-cyan-600 hover:bg-cyan-500'
                        }`}
                    >
                        {busy ? 'Working…' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
