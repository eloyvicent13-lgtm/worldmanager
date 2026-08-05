import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

/**
 * Small styling primitives. Deliberately built on plain Tailwind classes that
 * exist in every Pterodactyl palette (neutral / cyan / red / yellow / green)
 * instead of the panel's own components, so a themed panel cannot break them.
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'warning' | 'danger';

const VARIANTS: Record<Variant, string> = {
    primary: 'bg-cyan-600 hover:bg-cyan-500 text-white border-transparent',
    secondary: 'bg-neutral-700 hover:bg-neutral-600 text-neutral-100 border-neutral-600',
    ghost: 'bg-transparent hover:bg-neutral-700 text-neutral-300 border-transparent',
    warning: 'bg-yellow-700 hover:bg-yellow-600 text-white border-transparent',
    danger: 'bg-red-700 hover:bg-red-600 text-white border-transparent',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    icon?: IconDefinition;
    size?: 'sm' | 'md';
}

export function Button({ variant = 'secondary', icon, size = 'md', className = '', children, ...props }: ButtonProps) {
    const padding = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';

    return (
        <button
            type={'button'}
            {...props}
            className={`inline-flex items-center gap-2 rounded-md border font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${padding} ${VARIANTS[variant]} ${className}`}
        >
            {icon && <FontAwesomeIcon icon={icon} className={'opacity-80'} />}
            {children}
        </button>
    );
}

export function Card({
    children,
    className = '',
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={`rounded-xl border border-neutral-700 bg-neutral-800 bg-opacity-95 shadow-lg ${className}`}
        >
            {children}
        </div>
    );
}

export function CardHeader({ icon, title, action }: { icon?: IconDefinition; title: string; action?: React.ReactNode }) {
    return (
        <div className={'flex items-center justify-between border-b border-neutral-700 px-5 py-3'}>
            <div className={'flex items-center gap-3'}>
                {icon && <FontAwesomeIcon icon={icon} className={'text-neutral-400'} />}
                <h3 className={'text-sm font-semibold uppercase tracking-wider text-neutral-300'}>{title}</h3>
            </div>
            {action}
        </div>
    );
}

export function Badge({
    children,
    tone = 'neutral',
}: {
    children: React.ReactNode;
    tone?: 'neutral' | 'cyan' | 'green' | 'red' | 'yellow';
}) {
    const tones = {
        neutral: 'bg-neutral-700 text-neutral-300',
        cyan: 'bg-cyan-600 text-white',
        green: 'bg-green-700 text-green-100',
        red: 'bg-red-800 text-red-100',
        yellow: 'bg-yellow-700 text-yellow-100',
    };

    return (
        <span
            className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${tones[tone]}`}
        >
            {children}
        </span>
    );
}

export function Toggle({
    checked,
    onChange,
    label,
    disabled,
}: {
    checked: boolean;
    onChange: (value: boolean) => void;
    label: string;
    disabled?: boolean;
}) {
    return (
        <button
            type={'button'}
            role={'switch'}
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={'flex w-full items-center justify-between gap-4 text-left disabled:opacity-50'}
        >
            <span className={'text-sm text-neutral-200'}>{label}</span>
            <span
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-150 ${
                    checked ? 'bg-cyan-600' : 'bg-neutral-600'
                }`}
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-150 ${
                        checked ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
            </span>
        </button>
    );
}

export function Alert({
    tone,
    icon,
    children,
}: {
    tone: 'error' | 'success' | 'warning';
    icon?: IconDefinition;
    children: React.ReactNode;
}) {
    const tones = {
        error: 'border-red-700 bg-red-900 text-red-100',
        success: 'border-green-700 bg-green-900 text-green-100',
        warning: 'border-yellow-700 bg-yellow-900 text-yellow-100',
    };

    return (
        <div className={`mb-4 flex items-start gap-3 rounded-lg border bg-opacity-40 px-4 py-3 text-sm ${tones[tone]}`}>
            {icon && <FontAwesomeIcon icon={icon} className={'mt-0.5 flex-shrink-0'} />}
            <div>{children}</div>
        </div>
    );
}

export function Field({
    label,
    help,
    children,
}: {
    label: string;
    help?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <label className={'mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-400'}>
                {label}
            </label>
            {children}
            {help && <p className={'mt-1.5 text-xs text-neutral-500'}>{help}</p>}
        </div>
    );
}

export const inputClasses =
    'w-full rounded-md border border-neutral-600 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none transition-colors focus:border-cyan-500';
