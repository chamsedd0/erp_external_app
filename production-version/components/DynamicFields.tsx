import React, { useEffect, useState } from 'react';
import { View, Switch } from 'react-native';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useColor } from '@/hooks/useColor';
import { apiClient } from '@/api/client';

export interface OdooFieldDef {
    string: string;
    type: string;
    required?: boolean;
    selection?: [string, string][];
    relation?: string;
}

interface DynamicFieldsProps {
    /** Odoo model these custom fields belong to, e.g. 'hr.expense'. */
    sourceModel: string;
    fields: Record<string, OdooFieldDef>;
    values: Record<string, any>;
    onChange: (name: string, value: any) => void;
    accent?: string;
}

/** Renders tenant custom (x_) fields from a live Odoo schema. */
export function DynamicFields({ sourceModel, fields, values, onChange, accent }: DynamicFieldsProps) {
    const entries = Object.entries(fields || {});
    if (entries.length === 0) return null;

    return (
        <View style={{ gap: 16 }}>
            {entries.map(([name, def]) => (
                <DynamicField
                    key={name}
                    sourceModel={sourceModel}
                    name={name}
                    def={def}
                    value={values[name]}
                    onChange={onChange}
                    accent={accent}
                />
            ))}
        </View>
    );
}

function DynamicField({
    sourceModel,
    name,
    def,
    value,
    onChange,
    accent,
}: {
    sourceModel: string;
    name: string;
    def: OdooFieldDef;
    value: any;
    onChange: (name: string, value: any) => void;
    accent?: string;
}) {
    const text = useColor('text');
    const muted = useColor('textMuted');
    const cardColor = useColor('card');

    const [relOptions, setRelOptions] = useState<{ id: number; name: string }[]>([]);
    const [relLoading, setRelLoading] = useState(false);
    const [numberDraft, setNumberDraft] = useState(value != null ? String(value) : '');
    const [numberError, setNumberError] = useState('');

    useEffect(() => {
        let active = true;
        if (def.type === 'many2one') {
            setRelLoading(true);
            apiClient
                .getRelationOptions(sourceModel, name)
                .then((r) => { if (active) setRelOptions(r.options || []); })
                .catch(() => { if (active) setRelOptions([]); })
                .finally(() => { if (active) setRelLoading(false); });
        }
        return () => { active = false; };
    }, [def.type, sourceModel, name]);

    const Label = (
        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>
            {def.string}{def.required ? ' *' : ''}
        </Text>
    );

    switch (def.type) {
        case 'boolean':
            return (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: cardColor, borderRadius: 16, padding: 16 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: text, flex: 1 }}>{def.string}</Text>
                    <Switch value={!!value} onValueChange={(v) => onChange(name, v)} />
                </View>
            );

        case 'date':
        case 'datetime':
            return (
                <View style={{ gap: 10 }}>
                    {Label}
                    <DatePicker
                        value={value ? new Date(value) : null}
                        onChange={(d) => onChange(name, d ? d.toISOString() : null)}
                        placeholder={`Select ${def.string}`}
                    />
                </View>
            );

        case 'selection':
            return (
                <View style={{ gap: 10 }}>
                    {Label}
                    <SearchableSelect
                        options={(def.selection || []).map(([v, l]) => ({ id: v, name: l }))}
                        value={value ?? null}
                        onChange={(v) => onChange(name, v)}
                        accent={accent}
                        placeholder={`Select ${def.string}`}
                        label={def.string}
                    />
                </View>
            );

        case 'many2one':
            return (
                <View style={{ gap: 10 }}>
                    {Label}
                    <SearchableSelect
                        options={relOptions}
                        value={value ?? null}
                        onChange={(v) => onChange(name, v)}
                        loading={relLoading}
                        accent={accent}
                        placeholder={`Select ${def.string}`}
                        label={def.string}
                    />
                </View>
            );

        case 'integer':
        case 'float':
        case 'monetary':
            return (
                <View style={{ gap: 10 }}>
                    {Label}
                    <Input
                        placeholder={def.string}
                        value={numberDraft}
                        onChangeText={(txt) => {
                            setNumberDraft(txt);
                            const trimmed = txt.trim();
                            if (!trimmed) {
                                setNumberError('');
                                onChange(name, null);
                                return;
                            }
                            const valid = def.type === 'integer'
                                ? /^-?\d+$/.test(trimmed)
                                : /^-?\d+(\.\d+)?$/.test(trimmed);
                            if (!valid) {
                                setNumberError('Enter a valid number');
                                return;
                            }
                            setNumberError('');
                            onChange(name, def.type === 'integer' ? parseInt(trimmed, 10) : parseFloat(trimmed));
                        }}
                        keyboardType="numeric"
                        containerStyle={{ backgroundColor: cardColor, borderWidth: 0, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 }}
                        inputStyle={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: text }}
                    />
                    {numberError ? (
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#DC2626' }}>{numberError}</Text>
                    ) : null}
                </View>
            );

        case 'text':
            return (
                <View style={{ gap: 10 }}>
                    {Label}
                    <Input
                        placeholder={def.string}
                        value={value ?? ''}
                        onChangeText={(txt) => onChange(name, txt)}
                        multiline
                        textAlignVertical="top"
                        containerStyle={{ backgroundColor: cardColor, borderWidth: 0, height: 100, borderRadius: 16, padding: 16 }}
                        inputStyle={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: text }}
                    />
                </View>
            );

        case 'char':
        default:
            return (
                <View style={{ gap: 10 }}>
                    {Label}
                    <Input
                        placeholder={def.string}
                        value={value ?? ''}
                        onChangeText={(txt) => onChange(name, txt)}
                        containerStyle={{ backgroundColor: cardColor, borderWidth: 0, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 }}
                        inputStyle={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: text }}
                    />
                </View>
            );
    }
}
