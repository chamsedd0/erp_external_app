import { View, ScrollView, TouchableOpacity, Switch, RefreshControl } from 'react-native';
import { Text } from '../../components/ui/text';
import { useColor } from '../../hooks/useColor';
import { useRouter } from 'expo-router';
import { ChevronRight, Moon, Sun, Bell, Globe, Shield, Database, LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useToast } from '../../providers/toast-context';

type ToggleItem = {
    icon: LucideIcon;
    label: string;
    type: 'toggle';
    value: boolean;
    onToggle: (val: boolean) => void;
};

type NavigationItem = {
    icon: LucideIcon;
    label: string;
    subtitle?: string;
    type: 'navigation';
    onPress: () => void;
};

type SettingsItem = ToggleItem | NavigationItem;

export default function Settings() {
    const router = useRouter();
    const toast = useToast();
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const background = useColor('background');
    const text = useColor('text');
    const muted = useColor('textMuted');
    const cardColor = useColor('card');

    const handleToggle = (setting: string, value: boolean) => {
        toast.success(`${setting} ${value ? 'enabled' : 'disabled'}`);
    };

    const onRefresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 1000);
    };

    const settingsSections: Array<{ title: string; items: SettingsItem[] }> = [
        {
            title: 'Notifications',
            items: [
                {
                    icon: Bell,
                    label: 'Push Notifications',
                    type: 'toggle' as const,
                    value: notificationsEnabled,
                    onToggle: (val: boolean) => {
                        setNotificationsEnabled(val);
                        handleToggle('Push notifications', val);
                    },
                },
                {
                    icon: Bell,
                    label: 'Email Notifications',
                    type: 'toggle' as const,
                    value: emailNotifications,
                    onToggle: (val: boolean) => {
                        setEmailNotifications(val);
                        handleToggle('Email notifications', val);
                    },
                },
            ],
        },
        {
            title: 'Preferences',
            items: [
                {
                    icon: Globe,
                    label: 'Language',
                    subtitle: 'English',
                    type: 'navigation' as const,
                    onPress: () => toast.info('Language selection coming soon'),
                },
                {
                    icon: Moon,
                    label: 'Dark Mode',
                    subtitle: 'Coming soon',
                    type: 'navigation' as const,
                    onPress: () => toast.info('Dark mode coming soon'),
                },
            ],
        },
        {
            title: 'Security & Privacy',
            items: [
                {
                    icon: Shield,
                    label: 'Privacy Policy',
                    type: 'navigation' as const,
                    onPress: () => toast.info('Opening privacy policy'),
                },
                {
                    icon: Database,
                    label: 'Data Management',
                    type: 'navigation' as const,
                    onPress: () => toast.info('Data management coming soon'),
                },
            ],
        },
    ];

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: background }}
            contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
        >
            {/* Header */}
            <View style={{ marginBottom: 32 }}>
                <Text style={{ fontSize: 32, fontWeight: 'bold', color: text, marginBottom: 8 }}>
                    Settings
                </Text>
                <Text style={{ fontSize: 15, color: muted }}>
                    Manage your preferences
                </Text>
            </View>

            {/* Settings Sections */}
            {settingsSections.map((section, sectionIndex) => (
                <View key={sectionIndex} style={{ marginBottom: 32 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {section.title}
                    </Text>
                    <View style={{
                        backgroundColor: cardColor,
                        borderRadius: 20,
                        overflow: 'hidden',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.05,
                        shadowRadius: 8,
                        elevation: 2,
                    }}>
                        {section.items.map((item, itemIndex) => {
                            const Icon = item.icon;
                            const isLast = itemIndex === section.items.length - 1;

                            if (item.type === 'toggle') {
                                return (
                                    <View
                                        key={itemIndex}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            padding: 16,
                                            borderBottomWidth: isLast ? 0 : 1,
                                            borderBottomColor: 'rgba(0,0,0,0.05)',
                                        }}
                                    >
                                        <View style={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: 18,
                                            backgroundColor: 'rgba(0,0,0,0.05)',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginRight: 12,
                                        }}>
                                            <Icon size={18} color={text} />
                                        </View>
                                        <Text style={{ flex: 1, fontSize: 16, fontWeight: '500', color: text }}>
                                            {item.label}
                                        </Text>
                                        <Switch
                                            value={item.value}
                                            onValueChange={item.onToggle}
                                        />
                                    </View>
                                );
                            }

                            return (
                                <TouchableOpacity
                                    key={itemIndex}
                                    onPress={item.onPress}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        padding: 16,
                                        borderBottomWidth: isLast ? 0 : 1,
                                        borderBottomColor: 'rgba(0,0,0,0.05)',
                                    }}
                                >
                                    <View style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 18,
                                        backgroundColor: 'rgba(0,0,0,0.05)',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginRight: 12,
                                    }}>
                                        <Icon size={18} color={text} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 16, fontWeight: '500', color: text }}>
                                            {item.label}
                                        </Text>
                                        {item.subtitle && (
                                            <Text style={{ fontSize: 13, color: muted, marginTop: 2 }}>
                                                {item.subtitle}
                                            </Text>
                                        )}
                                    </View>
                                    <ChevronRight size={20} color={muted} />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            ))}
        </ScrollView>
    );
}
