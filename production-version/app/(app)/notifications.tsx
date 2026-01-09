import { View, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Text } from '../../components/ui/text';
import { useColor } from '../../hooks/useColor';
import { Bell, Check, AlertCircle, Info, ChevronLeft } from 'lucide-react-native';
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../api/client';
import { useSession } from '../../providers/auth-context';
import { useRouter, useFocusEffect } from 'expo-router';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'request_approved' | 'request_rejected' | 'system';
    read: boolean;
    timestamp: string;
    relatedRequestId?: number;
    relatedRequestType?: 'time_off' | 'expense';
}

export default function Notifications() {
    const { user } = useSession();
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const background = useColor('background');
    const text = useColor('text');
    const muted = useColor('textMuted');
    const cardColor = useColor('card');
    const pastelPurple = useColor('pastelPurple' as any);
    const pastelGreen = useColor('pastelGreen' as any);
    const pastelRed = useColor('pastelRed' as any) || '#ef4444'; // Fallback if not defined

    useFocusEffect(
        useCallback(() => {
            fetchNotifications();
        }, [])
    );

    const fetchNotifications = async () => {
        if (!user?.id) return;
        try {
            const data = await apiClient.getNotifications(user.id);
            setNotifications(data.notifications || []);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    const handlePress = async (notification: Notification) => {
        // 1. Mark as read
        if (!notification.read) {
            // Optimistically update UI
            setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
            // Call API
            apiClient.markNotificationRead(notification.id).catch(console.error);
        }

        // 2. Navigate if related request exists
        if (notification.relatedRequestId && notification.relatedRequestType) {
            router.push({
                pathname: '/(app)/request-details',
                params: {
                    id: notification.relatedRequestId.toString(),
                    type: notification.relatedRequestType
                }
            });
        }
    };

    const getIcon = (type: Notification['type']) => {
        switch (type) {
            case 'request_approved': return <Check size={20} color="#fff" strokeWidth={3} />;
            case 'request_rejected': return <AlertCircle size={20} color="#fff" strokeWidth={2.5} />;
            default: return <WaitIcon />;
        }
    };

    const WaitIcon = () => <Bell size={20} color="#fff" strokeWidth={2.5} />;

    const getBgColor = (type: Notification['type']) => {
        switch (type) {
            case 'request_approved': return '#10b981';
            case 'request_rejected': return '#ef4444';
            default: return '#3b82f6';
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return date.toLocaleDateString([], { weekday: 'short' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    // Grouping
    const groupedNotifications = notifications.reduce((acc: any, curr) => {
        const date = new Date(curr.timestamp);
        const today = new Date();
        let key = 'Earlier';

        if (date.toDateString() === today.toDateString()) {
            key = 'Today';
        } else {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            if (date.toDateString() === yesterday.toDateString()) {
                key = 'Yesterday';
            }
        }

        if (!acc[key]) acc[key] = [];
        acc[key].push(curr);
        return acc;
    }, {});


    const renderGroup = (label: string, items: Notification[]) => {
        return (
            <View key={label} style={{ marginBottom: 24 }}>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 13, color: muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {label}
                </Text>
                <View style={{ gap: 16 }}>
                    {items.map(item => (
                        <TouchableOpacity
                            key={item.id}
                            onPress={() => handlePress(item)}
                            style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}
                        >
                            <View style={{
                                width: 44, height: 44, borderRadius: 22,
                                backgroundColor: getBgColor(item.type),
                                alignItems: 'center', justifyContent: 'center',
                                marginTop: 2
                            }}>
                                {getIcon(item.type)}
                            </View>

                            <View style={{ flex: 1, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <Text style={{
                                        fontFamily: item.read ? 'Outfit_500Medium' : 'Outfit_700Bold',
                                        fontSize: 16,
                                        color: text,
                                        width: '80%'
                                    }} numberOfLines={1}>
                                        {item.title}
                                    </Text>
                                    <Text style={{
                                        fontFamily: 'DMSans_500Medium',
                                        fontSize: 12,
                                        color: item.read ? muted : text,
                                        fontWeight: item.read ? 'normal' : 'bold'
                                    }}>
                                        {formatTime(item.timestamp)}
                                    </Text>
                                </View>
                                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: muted, lineHeight: 20 }} numberOfLines={2}>
                                    {item.message}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: background }}>
            <View style={{ paddingTop: 30, paddingHorizontal: 24, paddingBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
                        <ChevronLeft size={24} color={text} />
                    </TouchableOpacity>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 32, color: text }}>
                        Notifications
                    </Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {loading && !refreshing ? (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <ActivityIndicator size="large" />
                    </View>
                ) : notifications.length === 0 ? (
                    <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 100 }}>
                        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: cardColor, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                            <Bell size={32} color={muted} opacity={0.5} />
                        </View>
                        <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 20, color: text, marginBottom: 8 }}>No notifications</Text>
                        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: muted, textAlign: 'center' }}>Updates on your requests will appear here.</Text>
                    </View>
                ) : (
                    <>
                        {groupedNotifications['Today'] && renderGroup('Today', groupedNotifications['Today'])}
                        {groupedNotifications['Yesterday'] && renderGroup('Yesterday', groupedNotifications['Yesterday'])}
                        {groupedNotifications['Earlier'] && renderGroup('Earlier', groupedNotifications['Earlier'])}
                    </>
                )}
            </ScrollView>
        </View>
    );
}
