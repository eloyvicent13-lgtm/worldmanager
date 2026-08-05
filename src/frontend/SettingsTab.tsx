import React, { useState } from 'react';
import { SETTING_SECTIONS, SettingField } from '@/worldmanager/settings';
import { WorldSettings } from '@/worldmanager/api';

interface Props {
    settings: WorldSettings;
    saving: boolean;
    onSave: (values: WorldSettings) => void;
}

const isTrue = (value: string) => String(value).toLowerCase() === 'true';

function Field({ field, value, onChange }: { field: SettingField; value: string; onChange: (v: string) => void }) {
    const input = 'w-full rounded bg-neutral-900 px-3 py-2 text-sm text-neutral-100 border border-neutral-700';

    if (field.type === 'bool') {
        return (
            <label className={'flex cursor-pointer items-center gap-3'}>
                <input
                    type={'checkbox'}
                    checked={isTrue(value)}
                    onChange={(event) => onChange(event.currentTarget.checked ? 'true' : 'false')}
                    className={'h-4 w-4 accent-cyan-500'}
                />
                <span className={'text-sm text-neutral-200'}>{field.label}</span>
            </label>
        );
    }

    return (
        <div>
            <label className={'mb-1 block text-xs uppercase tracking-wide text-neutral-400'}>{field.label}</label>
            {field.type === 'select' ? (
                <select className={input} value={value} onChange={(event) => onChange(event.currentTarget.value)}>
                    {!field.options?.includes(value) && <option value={value}>{value || '—'}</option>}
                    {field.options?.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            ) : (
                <input
                    className={input}
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={value}
                    onChange={(event) => onChange(event.currentTarget.value)}
                />
            )}
        </div>
    );
}

export default function SettingsTab({ settings, saving, onSave }: Props) {
    const [values, setValues] = useState<WorldSettings>(settings);

    const dirty = SETTING_SECTIONS.some((section) =>
        section.fields.some((field) => (values[field.key] ?? '') !== (settings[field.key] ?? ''))
    );

    return (
        <div>
            <p className={'mb-4 text-sm text-neutral-400'}>
                These values are written to <code className={'text-neutral-200'}>server.properties</code>. Minecraft
                only reads them while starting, so restart the server to apply changes.
            </p>

            <div className={'grid gap-4 lg:grid-cols-2'}>
                {SETTING_SECTIONS.map((section) => (
                    <div key={section.title} className={'rounded-lg bg-neutral-800 p-5'}>
                        <h3 className={'mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-300'}>
                            {section.title}
                        </h3>
                        <div className={'space-y-4'}>
                            {section.fields.map((field) => (
                                <div key={field.key}>
                                    <Field
                                        field={field}
                                        value={values[field.key] ?? ''}
                                        onChange={(value) => setValues({ ...values, [field.key]: value })}
                                    />
                                    {field.help && <p className={'mt-1 text-xs text-neutral-500'}>{field.help}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className={'mt-6 flex items-center gap-4'}>
                <button
                    type={'button'}
                    disabled={!dirty || saving}
                    onClick={() => onSave(values)}
                    className={
                        'rounded bg-cyan-600 px-5 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50'
                    }
                >
                    {saving ? 'Saving…' : 'Save settings'}
                </button>
                {dirty && !saving && <span className={'text-sm text-neutral-400'}>You have unsaved changes.</span>}
            </div>
        </div>
    );
}
