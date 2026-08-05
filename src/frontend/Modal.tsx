import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { Button } from '@/worldmanager/ui';

interface Props {
    title: string;
    icon?: IconDefinition;
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
    icon,
    description,
    confirmLabel = 'Confirm',
    confirmDanger,
    disabled,
    busy,
    onConfirm,
    onClose,
    children,
}: Props) {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !busy && onClose();
        document.addEventListener('keydown', onKey);

        return () => document.removeEventListener('keydown', onKey);
    }, [busy, onClose]);

    return (
        <div
            className={'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4'}
            onClick={(event) => event.target === event.currentTarget && !busy && onClose()}
        >
            <div className={'w-full max-w-lg overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800 shadow-2xl'}>
                <div className={'flex items-start gap-4 px-6 pt-6'}>
                    {icon && (
                        <span
                            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                                confirmDanger ? 'bg-red-900 text-red-300' : 'bg-neutral-700 text-neutral-300'
                            }`}
                        >
                            <FontAwesomeIcon icon={icon} />
                        </span>
                    )}
                    <div className={'min-w-0'}>
                        <h3 className={'text-lg font-semibold text-neutral-100'}>{title}</h3>
                        {description && <p className={'mt-1 text-sm leading-relaxed text-neutral-400'}>{description}</p>}
                    </div>
                </div>
                {children && <div className={'px-6 pt-5'}>{children}</div>}
                <div className={'mt-6 flex justify-end gap-3 border-t border-neutral-700 bg-neutral-900 px-6 py-4'}>
                    <Button variant={'ghost'} disabled={busy} onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant={confirmDanger ? 'danger' : 'primary'}
                        disabled={disabled || busy}
                        onClick={onConfirm}
                    >
                        {busy ? 'Working…' : confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}
