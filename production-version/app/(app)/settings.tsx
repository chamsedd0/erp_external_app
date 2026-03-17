import { View, ScrollView, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { Text } from '../../components/ui/text';
import { useColor } from '../../hooks/useColor';
import { Bell, CheckCheck, Info, Mail, Trash2, ChevronRight } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from '../../providers/toast-context';
import { useSession } from '../../providers/auth-context';
import { apiClient } from '../../api/client';
import Constants from 'expo-constants';
import { HR_EMAIL } from '../../constants';
import { LinearGradient } from 'expo-linear-gradient';

export default function Settings() {
    const toast = useToast();
    const { user } = useSession();
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [markingAllRead, setMarkingAllRead] = useState(false);
    const [clearingCache, setClearingCache] = useState(false);

    const background = useColor('background');
    const text = useColor('text');
    const muted = useColor('textMuted');
    const cardColor = useColor('card');
    const semanticInfo = useColor('semanticInfo' as any);
    const semanticError = useColor('semanticError' as any);

    const appVersion = Constants.expoConfig?.version ?? '1.0.0';

    useEffect(() => {
        AsyncStorage.getItem('setting_push_notifications')
            .then(val => { if (val !== null) setNotificationsEnabled(val === 'true'); })
            .catch(() => {});
    }, []);

    const handlePushToggle = (val: boolean) => {
        setNotificationsEnabled(val);
        AsyncStorage.setItem('setting_push_notifications', String(val)).catch(() => {});
        if (!val && user?.id) apiClient.deletePushToken(user.id).catch(() => {});
        toast.success(`Push notifications ${val ? 'enabled' : 'disabled'}`);
    };

    const handleMarkAllRead = async () => {
        if (!user?.id) return;
        setMarkingAllRead(true);
        try {
            await apiClient.markAllNotificationsRead();
            toast.success('All notifications marked as read');
        } catch (e: any) {
            toast.error(e.message || 'Failed to mark notifications as read');
        } finally {
            setMarkingAllRead(false);
        }
    };

    const handleClearCache = async () => {
        setClearingCache(true);
        try {
            const allKeys = await AsyncStorage.getAllKeys();
            const keepKeys = new Set([
                'user_token', 'user_data', 'is_new_user', 'setting_push_notifications',
            ]);
            const toRemove = allKeys.filter(k => !keepKeys.has(k));
            if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
            toast.success('Cache cleared successfully');
        } catch {
            toast.error('Failed to clear cache');
        } finally {
            setClearingCache(false);
        }
    };

    // ── Shared Components ───────────────────────────────────────────────────────

    const SectionHeader = ({ title }: { title: string }) => (
        <Text style={{
            fontFamily: 'DMSans_500Medium', fontSize: 12, color: muted,
            textTransform: 'uppercase', letterSpacing: 1.2,
            marginBottom: 12, paddingHorizontal: 4,
        }}>
            {title}
        </Text>
    );

    const RowDivider = () => (
        <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginLeft: 72 }} />
    );

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: background }}
            contentContainerStyle={{ padding: 24, paddingBottom: 140 }}
        >
            {/* Page Header */}
            <View style={{ marginBottom: 28 }}>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 32, color: text, marginBottom: 4 }}>
                    Settings
                </Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: muted }}>
                    App preferences & account
                </Text>
            </View>

            {/* ── Account Card ─────────────────────────────────────────────────── */}
            <View style={{
                backgroundColor: semanticInfo + '18',
                borderRadius: 28, padding: 20,
                flexDirection: 'row', alignItems: 'center', gap: 16,
                marginBottom: 32,
            }}>
                <LinearGradient
                    colors={['#E9E4F5', '#CBF0F9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                        width: 64, height: 64, borderRadius: 22,
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                >
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 26, color: '#1a1a1a' }}>
                        {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
                    </Text>
                </LinearGradient>

                <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 20, color: text }} numberOfLines={1}>
                        {user?.name || 'User'}
                    </Text>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: muted }} numberOfLines={1}>
                        {user?.job_title || 'Employee'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                        <View style={{ backgroundColor: semanticInfo + '28', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 }}>
                            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 12, color: semanticInfo }}>
                                ID #{user?.id}
                            </Text>
                        </View>
                        {user?.work_email ? (
                            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: muted }} numberOfLines={1}>
                                {user.work_email}
                            </Text>
                        ) : null}
                    </View>
                </View>
            </View>

            {/* ── Notifications Section ─────────────────────────────────────────── */}
            <View style={{ marginBottom: 32 }}>
                <SectionHeader title="Notifications" />
                <View style={{ backgroundColor: cardColor, borderRadius: 24, overflow: 'hidden' }}>

                    {/* Push Notifications toggle */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }}>
                        <View style={{
                            width: 40, height: 40, borderRadius: 14,
                            backgroundColor: semanticInfo + '18',
                            alignItems: 'center', justifyContent: 'center', marginRight: 14,
                        }}>
                            <Bell size={20} color={semanticInfo} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: text }}>
                                Push Notifications
                            </Text>
                            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: muted, marginTop: 1 }}>
                                {notificationsEnabled ? 'Enabled for this device' : 'Disabled for this device'}
                            </Text>
                        </View>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={handlePushToggle}
                            trackColor={{ false: 'rgba(0,0,0,0.1)', true: semanticInfo + '70' }}
                            thumbColor={notificationsEnabled ? semanticInfo : '#999'}
                            ios_backgroundColor="rgba(0,0,0,0.1)"
                        />
                    </View>

                    <RowDivider />

                    {/* Mark All as Read */}
                    <TouchableOpacity
                        onPress={handleMarkAllRead}
                        disabled={markingAllRead}
                        activeOpacity={0.7}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }}
                    >
                        <View style={{
                            width: 40, height: 40, borderRadius: 14,
                            backgroundColor: semanticInfo + '18',
                            alignItems: 'center', justifyContent: 'center', marginRight: 14,
                        }}>
                            {markingAllRead
                                ? <ActivityIndicator size="small" color={semanticInfo} />
                                : <CheckCheck size={20} color={semanticInfo} />
                            }
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: text }}>
                                Mark All as Read
                            </Text>
                            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: muted, marginTop: 1 }}>
                                Clear all unread notification badges
                            </Text>
                        </View>
                        {!markingAllRead && <ChevronRight size={18} color={muted} />}
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── About Section ─────────────────────────────────────────────────── */}
            <View style={{ marginBottom: 32 }}>
                <SectionHeader title="About" />
                <View style={{ backgroundColor: cardColor, borderRadius: 24, overflow: 'hidden' }}>

                    {/* App Version */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }}>
                        <View style={{
                            width: 40, height: 40, borderRadius: 14,
                            backgroundColor: muted + '18',
                            alignItems: 'center', justifyContent: 'center', marginRight: 14,
                        }}>
                            <Info size={20} color={muted} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: text }}>
                                App Version
                            </Text>
                            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: muted, marginTop: 1 }}>
                                Shadow Portal
                            </Text>
                        </View>
                        <View style={{ backgroundColor: muted + '18', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 }}>
                            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 13, color: muted }}>
                                v{appVersion}
                            </Text>
                        </View>
                    </View>

                    <RowDivider />

                    {/* HR Contact */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }}>
                        <View style={{
                            width: 40, height: 40, borderRadius: 14,
                            backgroundColor: muted + '18',
                            alignItems: 'center', justifyContent: 'center', marginRight: 14,
                        }}>
                            <Mail size={20} color={muted} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: text }}>
                                HR Contact
                            </Text>
                            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: muted, marginTop: 1 }}>
                                {HR_EMAIL}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* ── Data Section ──────────────────────────────────────────────────── */}
            <View>
                <SectionHeader title="Data" />
                <View style={{ backgroundColor: cardColor, borderRadius: 24, overflow: 'hidden' }}>
                    <TouchableOpacity
                        onPress={handleClearCache}
                        disabled={clearingCache}
                        activeOpacity={0.7}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }}
                    >
                        <View style={{
                            width: 40, height: 40, borderRadius: 14,
                            backgroundColor: semanticError + '18',
                            alignItems: 'center', justifyContent: 'center', marginRight: 14,
                        }}>
                            {clearingCache
                                ? <ActivityIndicator size="small" color={semanticError} />
                                : <Trash2 size={20} color={semanticError} />
                            }
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: text }}>
                                Clear App Cache
                            </Text>
                            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: muted, marginTop: 1 }}>
                                Remove locally stored filters & preferences
                            </Text>
                        </View>
                        {!clearingCache && <ChevronRight size={18} color={muted} />}
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
}
