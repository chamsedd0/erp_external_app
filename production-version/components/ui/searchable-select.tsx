import React, { useEffect, useMemo, useState } from 'react';
import {
    Modal,
    View,
    TouchableOpacity,
    FlatList,
    Pressable,
    ActivityIndicator,
    TextInput,
    StyleSheet,
    ViewStyle,
} from 'react-native';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, Search, X, RefreshCw } from 'lucide-react-native';
import { Text } from './text';
import { useColor } from '@/hooks/useColor';

export interface SelectOption {
    id: number | string;
    name: string;
    disabled?: boolean;
    disabledReason?: string;
}

export interface SearchableSelectProps {
    options: SelectOption[];
    value: number | string | null | (number | string)[];
    onChange: (value: any) => void;
    multiple?: boolean;
    placeholder?: string;
    searchPlaceholder?: string;
    label?: string;
    loading?: boolean;
    error?: string;
    onRetry?: () => void;
    accent?: string;
    disabled?: boolean;
    triggerStyle?: ViewStyle;
}

export function SearchableSelect({
    options,
    value,
    onChange,
    multiple = false,
    placeholder = 'Select…',
    searchPlaceholder = 'Search…',
    label,
    loading = false,
    error,
    onRetry,
    accent,
    disabled = false,
    triggerStyle,
}: SearchableSelectProps) {
    const background = useColor('background');
    const card = useColor('card');
    const text = useColor('text');
    const muted = useColor('textMuted');
    const border = useColor('border');
    const primary = useColor('primary');
    const highlight = accent ?? primary;

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    const selectedIds: (number | string)[] = useMemo(() => {
        if (multiple) return Array.isArray(value) ? value : [];
        if (value == null || Array.isArray(value)) return [];
        return [value];
    }, [value, multiple]);

    const triggerLabel = useMemo(() => {
        if (selectedIds.length === 0) return placeholder;
        const names = selectedIds
            .map((id) => options.find((o) => o.id === id)?.name)
            .filter(Boolean) as string[];
        if (names.length === 0) return placeholder;
        if (multiple && names.length > 1) return `${names.length} selected`;
        return names.join(', ');
    }, [selectedIds, options, placeholder, multiple]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter((o) => o.name.toLowerCase().includes(q));
    }, [options, query]);

    const handleSelect = (option: SelectOption) => {
        if (option.disabled) return;
        if (multiple) {
            const current = Array.isArray(value) ? value : [];
            const next = current.includes(option.id)
                ? current.filter((v) => v !== option.id)
                : [...current, option.id];
            onChange(next);
        } else {
            onChange(value === option.id ? null : option.id);
            close();
        }
    };

    // ── Bottom-sheet animation ──────────────────────────────────────────────
    const insets = useSafeAreaInsets();
    const [visible, setVisible] = useState(false);
    const translateY = useSharedValue(600);
    const overlay = useSharedValue(0);

    useEffect(() => {
        if (open) {
            setVisible(true);
            translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.quad) });
            overlay.value = withTiming(1, { duration: 280 });
        } else if (visible) {
            overlay.value = withTiming(0, { duration: 220 });
            translateY.value = withTiming(600, { duration: 220 }, (finished) => {
                if (finished) runOnJS(setVisible)(false);
            });
        }
    }, [open]);

    const close = () => {
        setQuery('');
        setOpen(false);
    };

    const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
    const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value * 0.4 }));

    const selectedTrigger = selectedIds.length > 0;

    return (
        <>
            <TouchableOpacity
                activeOpacity={0.7}
                disabled={disabled}
                onPress={() => setOpen(true)}
                style={[
                    {
                        backgroundColor: card,
                        borderWidth: 1,
                        borderColor: selectedTrigger ? highlight : 'transparent',
                        borderRadius: 16,
                        paddingHorizontal: 18,
                        paddingVertical: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        opacity: disabled ? 0.5 : 1,
                    },
                    triggerStyle,
                ]}
            >
                <Text
                    numberOfLines={1}
                    style={{
                        flex: 1,
                        fontFamily: selectedTrigger ? 'DMSans_700Bold' : 'DMSans_400Regular',
                        fontSize: 15,
                        color: selectedTrigger ? text : muted,
                    }}
                >
                    {loading ? 'Loading…' : triggerLabel}
                </Text>
                {loading ? (
                    <ActivityIndicator size="small" color={muted} />
                ) : (
                    <ChevronDown size={18} color={muted} />
                )}
            </TouchableOpacity>

            <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
                <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, overlayStyle]}>
                        <Pressable style={{ flex: 1 }} onPress={close} />
                    </Animated.View>

                    <Animated.View
                        style={[
                            {
                                backgroundColor: background,
                                borderTopLeftRadius: 28,
                                borderTopRightRadius: 28,
                                paddingTop: 12,
                                paddingBottom: insets.bottom + 12,
                                maxHeight: '80%',
                            },
                            sheetStyle,
                        ]}
                    >
                        {/* Handle */}
                        <View style={{ alignItems: 'center', marginBottom: 8 }}>
                            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: border }} />
                        </View>

                        {/* Header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 }}>
                            <Text style={{ flex: 1, fontFamily: 'Outfit_700Bold', fontSize: 20, color: text }}>
                                {label ?? placeholder}
                            </Text>
                            <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <X size={22} color={muted} />
                            </TouchableOpacity>
                        </View>

                        {/* Search box */}
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                                marginHorizontal: 20,
                                marginBottom: 12,
                                paddingHorizontal: 14,
                                height: 46,
                                borderRadius: 14,
                                backgroundColor: card,
                            }}
                        >
                            <Search size={18} color={muted} />
                            <TextInput
                                value={query}
                                onChangeText={setQuery}
                                placeholder={searchPlaceholder}
                                placeholderTextColor={muted}
                                autoCorrect={false}
                                style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 16, color: text, padding: 0 }}
                            />
                            {query.length > 0 && (
                                <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <X size={16} color={muted} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Body */}
                        {loading ? (
                            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                                <ActivityIndicator size="large" color={highlight} />
                            </View>
                        ) : error ? (
                            <View style={{ paddingVertical: 36, paddingHorizontal: 20, alignItems: 'center', gap: 12 }}>
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted, textAlign: 'center' }}>
                                    {error}
                                </Text>
                                {onRetry && (
                                    <TouchableOpacity
                                        onPress={onRetry}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: card, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}
                                    >
                                        <RefreshCw size={16} color={highlight} />
                                        <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 14, color: highlight }}>Retry</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : (
                            <FlatList
                                data={filtered}
                                keyExtractor={(item) => String(item.id)}
                                keyboardShouldPersistTaps="handled"
                                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
                                ListEmptyComponent={
                                    <View style={{ paddingVertical: 36, alignItems: 'center' }}>
                                        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: muted }}>
                                            No results
                                        </Text>
                                    </View>
                                }
                                renderItem={({ item }) => {
                                    const isSelected = selectedIds.includes(item.id);
                                    return (
                                        <TouchableOpacity
                                            activeOpacity={0.7}
                                            onPress={() => handleSelect(item)}
                                            disabled={item.disabled}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                gap: 12,
                                                paddingVertical: 14,
                                                paddingHorizontal: 14,
                                                borderRadius: 14,
                                                marginBottom: 6,
                                                backgroundColor: isSelected ? highlight + '18' : 'transparent',
                                                opacity: item.disabled ? 0.45 : 1,
                                            }}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text
                                                    style={{
                                                        fontFamily: isSelected ? 'DMSans_700Bold' : 'DMSans_500Medium',
                                                        fontSize: 15,
                                                        color: isSelected ? highlight : text,
                                                    }}
                                                >
                                                    {item.name}
                                                </Text>
                                                {item.disabled && item.disabledReason && (
                                                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: muted, marginTop: 2 }}>
                                                        {item.disabledReason}
                                                    </Text>
                                                )}
                                            </View>
                                            {isSelected && <Check size={20} color={highlight} />}
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        )}

                        {/* Done button for multi-select */}
                        {multiple && !loading && !error && (
                            <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
                                <TouchableOpacity
                                    onPress={close}
                                    style={{ backgroundColor: highlight, borderRadius: 16, height: 52, alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 16, color: '#fff' }}>Done</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </Animated.View>
                </View>
            </Modal>
        </>
    );
}
