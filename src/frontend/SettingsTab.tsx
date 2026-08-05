import React, { useState } from 'react';
import { faCog, faGamepad, faGlobe, faTachometerAlt, faUsers } from '@fortawesome/free-solid-svg-icons';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { SETTING_SECTIONS, SettingField } from '@/worldmanager/settings';
import { WorldSettings } from '@/worldmanager/api';
import { Button, Card, CardHeader, Field, Toggle, inputClasses } from '@/worldmanager/ui';

interface Props {
    settings: WorldSettings;
    saving: boolean;
    onSave: (values: WorldSettings) => void;
}

const SECTION_ICONS: Record<string, IconDefinition> = {
    World: faGlobe,
    Gameplay: faGamepad,
    Spawning: faCog,
    Players: faUsers,
    Performance: faTachometerAlt,
};

const isTrue = (value: string) => String(value).toLowerCase() === 'true';

function Input({ field, value, onChange }: { field: SettingField; value: string; onChange: (v: string) => void }) {
    if (field.type === 'bool') {
        return <Toggle label={field.label} checked={isTrue(value)} onChange={(on) => onChange(on ? 'true' : 'false')} />;
    }

    return (
        <Field label={field.label} help={field.help}>
            {field.type === 'select' ? (
                <select
                    className={inputClasses}
                    value={value}
                    onChange={(event) => onChange(event.currentTarget.value)}
                >
                    {!field.options?.includes(value) && <option value={value}>{value || '—'}</option>}
                    {field.options?.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            ) : (
                <input
                    className={inputClasses}
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={value}
                    placeholder={field.placeholder}
                    onChange={(event) => onChange(event.currentTarget.value)}
                />
            )}
        </Field>
    );
}

export default function SettingsTab({ settings, saving, onSave }: Props) {
    const [values, setValues] = useState<WorldSettings>(settings);

    const changed = SETTING_SECTIONS.flatMap((section) => section.fields)
        .map((field) => field.key)
        .filter((key) => (values[key] ?? '') !== (settings[key] ?? ''));

    return (
        <div>
            <p className={'mb-5 text-sm text-neutral-400'}>
                Written to <code className={'rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-200'}>server.properties</code>.
                Minecraft reads these only while starting, so restart the server to apply them.
            </p>

            <div className={'grid gap-5 xl:grid-cols-2'}>
                {SETTING_SECTIONS.map((section) => (
                    <Card key={section.title} className={'h-fit'}>
                        <CardHeader icon={SECTION_ICONS[section.title]} title={section.title} />
                        <div className={'space-y-5 p-5'}>
                            {section.fields.map((field) => (
                                <Input
                                    key={field.key}
                                    field={field}
                                    value={values[field.key] ?? ''}
                                    onChange={(value) => setValues({ ...values, [field.key]: value })}
                                />
                            ))}
                        </div>
                    </Card>
                ))}
            </div>

            <div
                className={
                    'sticky bottom-0 mt-6 flex items-center gap-4 rounded-xl border border-neutral-700 bg-neutral-800 bg-opacity-95 px-5 py-4 shadow-lg'
                }
            >
                <Button variant={'primary'} disabled={changed.length === 0 || saving} onClick={() => onSave(values)}>
                    {saving ? 'Saving…' : 'Save settings'}
                </Button>
                <span className={'text-sm text-neutral-400'}>
                    {changed.length === 0
                        ? 'No changes.'
                        : `${changed.length} unsaved change${changed.length === 1 ? '' : 's'}: ${changed.join(', ')}`}
                </span>
            </div>
        </div>
    );
}
